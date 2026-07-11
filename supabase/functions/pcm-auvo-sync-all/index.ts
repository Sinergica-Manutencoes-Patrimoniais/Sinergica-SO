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
 *
 * Pulls em paralelo (Promise.all), não em série: cada entidade é uma invocação de Edge Function
 * própria (login Auvo + fetch), e encadear 13+ delas sequencialmente somava tempo suficiente pra
 * `pcm-auvo-sync-all` bater em WORKER_RESOURCE_LIMIT do Supabase (achado testando o botão
 * "Sincronizar Auvo" em produção, 2026-07-08 — reduzir a janela de tickets/tasks não mudou nada,
 * porque o gargalo real era a soma serial das 13 chamadas, não o volume de nenhuma delas). Só
 * `tasks-import` continua depois de TODOS os pulls terminarem: ele resolve o cliente de cada
 * tarefa em `pcm.clientes` em lote, e precisa que `pull:clientes` já tenha rodado.
 */
export async function runSyncAll(
  entities: string[],
  call: Caller,
  tasksImportBody?: Record<string, unknown>,
): Promise<{ ok: boolean; results: StepResult[] }> {
  const pullResults = await Promise.all(
    entities.map(async (entity): Promise<StepResult> => {
      try {
        const detail = await call("pcm-auvo-pull", { entity });
        return { step: `pull:${entity}`, ok: true, detail };
      } catch (e) {
        return { step: `pull:${entity}`, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  let taskImportResult: StepResult;
  try {
    const detail = await call("pcm-auvo-tasks-import", tasksImportBody);
    taskImportResult = { step: "tasks-import", ok: true, detail };
  } catch (e) {
    taskImportResult = { step: "tasks-import", ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  let deletedTasksResult: StepResult;
  try {
    const detail = await call("pcm-auvo-deleted-tasks-sync", tasksImportBody);
    deletedTasksResult = { step: "deleted-tasks", ok: true, detail };
  } catch (e) {
    deletedTasksResult = { step: "deleted-tasks", ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  let gpsResult: StepResult;
  try {
    const detail = await call("pcm-auvo-gps-pull");
    gpsResult = { step: "gps", ok: true, detail };
  } catch (e) {
    gpsResult = { step: "gps", ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const supportResults = await Promise.all((["questionnaires", "expenses", "satisfactions"] as const).map(async (resource): Promise<StepResult> => {
    try { return { step: resource, ok: true, detail: await call("pcm-auvo-support-pull", { resource }) }; }
    catch (e) { return { step: resource, ok: false, error: e instanceof Error ? e.message : String(e) }; }
  }));

  const results = [...pullResults, taskImportResult, deletedTasksResult, gpsResult, ...supportResults];
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

interface SyncAllRequestBody {
  /** Pula os pulls de entidade e roda só `tasks-import` — usado pelo script de backfill histórico
   * pra rodar em fatias de data sem repetir os pulls das outras 13 entidades a cada fatia. */
  skipPulls?: boolean;
  /** Repassado como corpo de `pcm-auvo-tasks-import` — override pontual da janela padrão pequena,
   * pro backfill histórico em fatias (script pontual, não repetível/agendado). */
  tasksImportRange?: { startDate?: string; endDate?: string };
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

    const body = (await req.json().catch(() => ({}))) as SyncAllRequestBody;
    const entities = body.skipPulls ? [] : listEntities();
    const resultado = await runSyncAll(entities, makeSupabaseCaller(url, serviceKey), body.tasksImportRange);

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
