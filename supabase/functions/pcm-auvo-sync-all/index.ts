// pcm-auvo-sync-all — orquestrador do botão global "Sincronizar Auvo" (E01-S37). Chamado pela UI
// (sessão do usuário, `requireAuth` + gate de permissão pcm:escrita), dispara o pull de TODAS as
// entidades do registry (mesmas que o cron de `0037` chama) + `pcm-auvo-tasks-import` (reconcilia
// tarefas Auvo → OS aberta no PCM, mesma lógica de `0038`). É pull on-demand: os writes continuam
// instantâneos via drain imediato (E01-S36); o refresh por página continua lendo cache local.
//
// Erro de UMA entidade nunca aborta as demais (AC-3) — cada chamada interna é isolada, resultado
// agregado por entidade/etapa. Nunca lança para o chamador.
//
// E01-S67: responde 202 com `{ runId }` IMEDIATO — o trabalho real roda depois via
// `EdgeRuntime.waitUntil` (mesmo padrão de `pcm-whatsapp-webhook`), gravando progresso em
// `pcm.auvo_sync_runs`. Sair da página/fechar a aba não mata mais o sync no meio (antes, o fetch
// síncrono do browser ERA o lifecycle da requisição). UI faz polling na tabela, sem função nova.
//
// NÃO VERIFICADO NESTE AMBIENTE: sem Deno CLI aqui, este código não foi type-checked nem executado.
// A lógica de agregação (`runSyncAll`) é testada isoladamente contra um stub de `Caller` em
// `index.test.ts`, sem depender de fetch real.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireAuth } from "../_shared/auth.ts";
import { listEntities } from "../_shared/auvo/registry/index.ts";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";

const FN = "pcm-auvo-sync-all";

export interface StepResult {
  step: string;
  ok: boolean;
  detail?: unknown;
  error?: string;
}

export interface CallOptions {
  /** Orçamento de tempo desta etapa dentro do clique do botão. Estourou → a chamada é abortada do
   * lado do orquestrador (a etapa é reportada como falha honesta), mas a Edge Function interna já
   * invocada pode seguir rodando no próprio worker — e o cron (horário/diário) reconcilia depois. */
  timeoutMs?: number;
}

/** Chama uma Edge Function interna (mesmo projeto) e devolve o corpo da resposta. Lança se a
 * resposta não for 2xx — `runSyncAll` decide o que fazer com a exceção (nunca deixa vazar). */
export type Caller = (path: string, body?: unknown, opts?: CallOptions) => Promise<unknown>;

// Orçamentos por etapa (E01-S62). Incidente de 2026-07-13: o pull de tickets (janela 180d+60d,
// ~24 páginas a ~6s/página no Auvo) levava ~150s — o `Promise.all` dos pulls esperava por ele e o
// worker do PRÓPRIO sync-all morria em WORKER_RESOURCE_LIMIT (150s) antes de chamar
// `tasks-import`: OS novas do Auvo nunca entravam pelo botão (saúde de sync mostrou os pulls OK
// às 18:58 e tickets só às 19:00:27, nenhuma OS criada). A soma dos orçamentos no caminho crítico
// (clientes → resto em paralelo) fica ≤ ~120s, sempre abaixo do teto.
const ORCAMENTO_PULL_CLIENTES_MS = 30_000;
const ORCAMENTO_PULL_MS = 60_000;
const ORCAMENTO_TASKS_IMPORT_MS = 90_000;
const ORCAMENTO_ETAPA_APOIO_MS = 45_000; // deleted-tasks/gps/support (satisfações já tem budget interno de 45s)

/**
 * Roda o pull de cada entidade + o import de tarefas, isolando falha por etapa (AC-3). Pura o
 * suficiente para testar com um `Caller` stub — não depende de fetch real nem de env vars.
 *
 * Ordem de execução (E01-S62): `pull:clientes` roda PRIMEIRO e sozinho (é a única dependência do
 * `tasks-import`, que resolve o cliente de cada tarefa em lote); todo o resto — demais pulls,
 * tasks-import, deleted-tasks, gps e support — roda em paralelo, cada etapa com orçamento próprio
 * de tempo. Uma etapa lenta (ex.: tickets) estoura só o orçamento dela e vira falha isolada e
 * nomeada no resultado; nunca mais segura o orquestrador inteiro até o teto do worker.
 */
export async function runSyncAll(
  entities: string[],
  call: Caller,
  tasksImportBody?: Record<string, unknown>,
): Promise<{ ok: boolean; results: StepResult[] }> {
  const etapa = async (
    step: string,
    path: string,
    body: unknown,
    timeoutMs: number,
  ): Promise<StepResult> => {
    try {
      const detail = await call(path, body, { timeoutMs });
      return { step, ok: true, detail };
    } catch (e) {
      return { step, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  // 1. clientes primeiro — dependência do tasks-import (resolução de cliente em lote).
  const temClientes = entities.includes("clientes");
  const clientesResult = temClientes
    ? await etapa("pull:clientes", "pcm-auvo-pull", { entity: "clientes" }, ORCAMENTO_PULL_CLIENTES_MS)
    : null;

  // 2. Todo o resto em paralelo, orçamento por etapa. A ordem do array de resultados é estável
  //    (pulls na ordem do registry, depois as etapas fixas), independente de quem termina antes.
  const demaisEntidades = entities.filter((e) => e !== "clientes");
  const [pullResults, taskImportResult, deletedTasksResult, gpsResult, supportResults] = await Promise
    .all([
      Promise.all(demaisEntidades.map((entity) =>
        etapa(`pull:${entity}`, "pcm-auvo-pull", { entity }, ORCAMENTO_PULL_MS)
      )),
      etapa("tasks-import", "pcm-auvo-tasks-import", tasksImportBody, ORCAMENTO_TASKS_IMPORT_MS),
      etapa("deleted-tasks", "pcm-auvo-deleted-tasks-sync", tasksImportBody, ORCAMENTO_ETAPA_APOIO_MS),
      etapa("gps", "pcm-auvo-gps-pull", undefined, ORCAMENTO_ETAPA_APOIO_MS),
      Promise.all((["questionnaires", "expenses", "satisfactions"] as const).map((resource) =>
        etapa(resource, "pcm-auvo-support-pull", { resource }, ORCAMENTO_ETAPA_APOIO_MS)
      )),
    ]);

  const results = [
    ...(clientesResult ? [clientesResult] : []),
    ...pullResults,
    taskImportResult,
    deletedTasksResult,
    gpsResult,
    ...supportResults,
  ];
  return { ok: results.every((r) => r.ok), results };
}

export function makeSupabaseCaller(url: string, serviceKey: string, fetchFn: typeof fetch = fetch): Caller {
  return async (path, body, opts) => {
    const controller = new AbortController();
    const timer = opts?.timeoutMs != null ? setTimeout(() => controller.abort(), opts.timeoutMs) : null;
    try {
      const res = await fetchFn(`${url}/functions/v1/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof payload === "object" && payload !== null && "detail" in payload ? String((payload as { detail?: unknown }).detail) : `HTTP ${res.status}`;
        throw new Error(message);
      }
      return payload;
    } catch (e) {
      if (controller.signal.aborted) {
        const segundos = Math.round((opts?.timeoutMs ?? 0) / 1000);
        throw new Error(
          `etapa excedeu o orçamento de ${segundos}s do botão — pode ter continuado no servidor; o cron reconcilia depois`,
        );
      }
      throw e;
    } finally {
      if (timer != null) clearTimeout(timer);
    }
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

/** Cria a linha de progresso (E01-S67) — a UI faz polling nela em vez de esperar a resposta HTTP. */
async function criarRun(db: UntypedSupabaseClient, requestedBy: string): Promise<string> {
  const { data, error } = await db
    .schema("pcm")
    .from("auvo_sync_runs")
    .insert({ status: "running", requested_by: requestedBy })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function finalizarRun(
  db: UntypedSupabaseClient,
  runId: string,
  resultado: { ok: boolean; results: StepResult[] },
): Promise<void> {
  const { error } = await db
    .schema("pcm")
    .from("auvo_sync_runs")
    .update({
      status: resultado.ok ? "succeeded" : "failed",
      ok: resultado.ok,
      results: resultado.results,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) console.error(JSON.stringify({ nivel: "error", fn: FN, msg: "falha ao gravar conclusão do run", runId }));
}

async function finalizarRunComErro(db: UntypedSupabaseClient, runId: string, e: unknown): Promise<void> {
  const { error } = await db
    .schema("pcm")
    .from("auvo_sync_runs")
    .update({
      status: "failed",
      ok: false,
      results: [{ step: "sync-all", ok: false, error: e instanceof Error ? e.message : String(e) }],
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) console.error(JSON.stringify({ nivel: "error", fn: FN, msg: "falha ao gravar erro do run", runId }));
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

    const { userId } = await requireAuth(req);
    const claims = claimsFrom(req);
    if (claims.user_role !== "superadmin" && claims.user_modulos?.pcm !== "escrita") {
      throw new HttpError(403, "Sem permissão de escrita no PCM");
    }

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!url || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");

    const body = (await req.json().catch(() => ({}))) as SyncAllRequestBody;
    const entities = body.skipPulls ? [] : listEntities();

    // E01-S67: responde IMEDIATO com o runId — o processamento continua no servidor via
    // `EdgeRuntime.waitUntil` (mesmo padrão de `pcm-whatsapp-webhook`), imune a navegação/fechar
    // aba do browser (antes, o fetch síncrono do browser era o próprio lifecycle da requisição —
    // sair da página matava o sync no meio). UI faz polling em `pcm.auvo_sync_runs`.
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) as UntypedSupabaseClient;
    const runId = await criarRun(db, userId);

    const run = () =>
      runSyncAll(entities, makeSupabaseCaller(url, serviceKey), body.tasksImportRange)
        .then((resultado) => {
          console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, runId, msg: "sync-all concluído", ok: resultado.ok, etapas: resultado.results.length }));
          return finalizarRun(db, runId, resultado);
        })
        .catch((e) => {
          console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, runId, msg: "sync-all falhou em background", detail: String(e) }));
          return finalizarRunComErro(db, runId, e);
        });
    const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
    edgeRuntime?.waitUntil ? edgeRuntime.waitUntil(run()) : run();

    return json(202, { runId, status: "running" }, cors);
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
