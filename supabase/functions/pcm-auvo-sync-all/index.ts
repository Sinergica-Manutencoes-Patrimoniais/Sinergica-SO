// pcm-auvo-sync-all — orquestrador do botão global "Sincronizar Auvo" (E01-S37). Chamado pela UI
// (sessão do usuário, `requireAuth` + gate de permissão pcm:escrita), dispara o pull de TODAS as
// entidades do registry (mesmas que o cron de `0037` chama) + `pcm-auvo-tasks-import` (reconcilia
// tarefas Auvo → OS aberta no PCM, mesma lógica de `0038`). É pull on-demand: os writes continuam
// instantâneos via drain imediato (E01-S36); o refresh por página continua lendo cache local.
//
// Erro de UMA entidade nunca aborta as demais (AC-3) — cada chamada interna é isolada, resultado
// agregado por entidade/etapa. Nunca lança para o chamador.
//
// NÃO VERIFICADO NESTE AMBIENTE: sem Deno CLI aqui, este código não foi type-checked nem executado.
// A lógica de agregação (`runSyncAll`) é testada isoladamente contra um stub de `Caller` em
// `index.test.ts`, sem depender de fetch real.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireAuth } from "../_shared/auth.ts";
import { listEntities } from "../_shared/auvo/registry/index.ts";

const FN = "pcm-auvo-sync-all";

export interface StepResult {
  step: string;
  ok: boolean;
  detail?: unknown;
  error?: string;
}

/** Chama uma Edge Function interna (mesmo projeto) e devolve o corpo da resposta. Lança se a
 * resposta não for 2xx — `runSyncAll` decide o que fazer com a exceção (nunca deixa vazar). */
export type Caller = (path: string, body?: unknown) => Promise<unknown>;

/**
 * Roda o pull de cada entidade + o import de tarefas, isolando falha por etapa (AC-3). Pura o
 * suficiente para testar com um `Caller` stub — não depende de fetch real nem de env vars.
 */
export async function runSyncAll(entities: string[], call: Caller): Promise<{ ok: boolean; results: StepResult[] }> {
  const results: StepResult[] = [];

  for (const entity of entities) {
    try {
      const detail = await call("pcm-auvo-pull", { entity });
      results.push({ step: `pull:${entity}`, ok: true, detail });
    } catch (e) {
      results.push({ step: `pull:${entity}`, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  try {
    const detail = await call("pcm-auvo-tasks-import");
    results.push({ step: "tasks-import", ok: true, detail });
  } catch (e) {
    results.push({ step: "tasks-import", ok: false, error: e instanceof Error ? e.message : String(e) });
  }

  return { ok: results.every((r) => r.ok), results };
}

function makeSupabaseCaller(url: string, serviceKey: string): Caller {
  return async (path, body) => {
    const res = await fetch(`${url}/functions/v1/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(body ?? {}),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = typeof payload === "object" && payload !== null && "detail" in payload ? String((payload as { detail?: unknown }).detail) : `HTTP ${res.status}`;
      throw new Error(message);
    }
    return payload;
  };
}

function claimsFrom(req: Request): { user_role?: string; user_modulos?: Record<string, string> } {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const [, payload] = token.split(".");
  if (!payload) return {};
  try {
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

if (import.meta.main) serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, method: req.method }));

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");

    await requireAuth(req);
    const claims = claimsFrom(req);
    if (claims.user_role !== "superadmin" && claims.user_modulos?.pcm !== "escrita") {
      throw new HttpError(403, "Sem permissão de escrita no PCM");
    }

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!url || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");

    const entities = listEntities();
    const resultado = await runSyncAll(entities, makeSupabaseCaller(url, serviceKey));

    console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, msg: "sync-all concluído", ok: resultado.ok, etapas: resultado.results.length }));
    return json(200, { ...resultado, syncedAt: now }, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors);
  }
});

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function problem(status: number, detail: string, reqId: string, cors: Record<string, string>): Response {
  const titles: Record<number, string> = {
    401: "Unauthorized",
    403: "Forbidden",
    405: "Method Not Allowed",
    500: "Internal Server Error",
  };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
