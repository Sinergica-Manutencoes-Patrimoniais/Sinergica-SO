// pcm-auvo-tasks-import — reconciliação Auvo→PCM de Ordens de Serviço (E01-S34). Mesmo padrão de
// `pcm-auvo-customers-import` (E01-S13): pagina TODAS as tarefas do Auvo e cria a OS local para
// as que não têm `auvo_task_id` correspondente ainda (backfill de tarefas antigas + rede de
// segurança pro que o webhook perder). Resolve cliente/numeração/autoria em LOTE (1 query cada pro
// backfill inteiro) e faz insert em lote — diferente do webhook em tempo real (`pcm-auvo-webhook`,
// 1 tarefa por vez via `criarOsDaTarefa`), mas reaproveita a mesma montagem de linha
// (`montarLinhaOs`, _shared/auvo/os-from-task.ts) pra não duplicar o formato entre os dois.
//
// Assimetria intencional em relação a `pcm-auvo-customers-import`: NÃO faz soft-delete de OS que
// sumiram do Auvo. OS é dado operacional do PCM — uma tarefa cancelada/removida no Auvo não deveria
// apagar/desativar histórico local (ver design.md).
//
// Gatilho: `pg_cron` diário (migration 0038) via `net.http_post`, ou invocação manual
// (`supabase functions invoke pcm-auvo-tasks-import`).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { AuvoApiError, auvoGet, buildParamFilter } from "../_shared/auvo/client.ts";
import { auvoPaginate, DEFAULT_PAGE_SIZE } from "../_shared/auvo/paginate.ts";
import {
  contarOsExistentes,
  formatarNumeroOs,
  montarLinhaOs,
  obterUsuarioSistema,
  type OsStatus,
  resolverClienteIdsPorAuvoIds,
} from "../_shared/auvo/os-from-task.ts";

/** Máximo de linhas por `insert()` em lote — payload único grande demais é tão arriscado quanto
 * 1 round-trip por linha; fatiar mantém os dois lados saudáveis mesmo num backfill grande. */
const TAMANHO_LOTE_INSERT = 200;

const FN = "pcm-auvo-tasks-import";

const AUVO_TASK_STATUS_FINALIZADA = 5;
const AUVO_TASK_STATUS_EM_ANDAMENTO = new Set([2, 3, 4]);

interface AuvoTask {
  id?: number;
  taskId?: number;
  title?: string;
  description?: string;
  taskTitle?: string;
  customerId?: number;
  taskStatus?: number;
  status?: number;
}

interface AuvoTasksResponse {
  result?: AuvoTask[] | {
    entityList?: AuvoTask[];
  };
}

if (import.meta.main) serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, method: req.method }));

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");

    // Auth — chamada interna sistema→sistema (cron ou invocação manual autenticada), nunca frontend.
    requireServiceRole(req);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!url || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // `GET /tasks` EXIGE startDate/endDate (via paramFilter) quando customerId não é informado —
    // confirmado direto na API real (400 "Start date and end date are required when customerId is
    // not provided", errorCode 168). Reconciliação varre TODAS as tarefas, não uma por cliente, então
    // usa uma janela de data (180 dias passado a 60 dias futuro) em vez de customerId. Janela
    // reduzida de 10 anos: uma janela ampla paginava histórico demais e o sync-all inteiro batia em
    // WORKER_RESOURCE_LIMIT do Supabase quando chamado pelo botão "Sincronizar Auvo" (achado
    // testando em produção, 2026-07-08) — ver specs/E01-S34.../design.md.
    const agora = new Date();
    const inicio = new Date(agora);
    inicio.setDate(inicio.getDate() - 180);
    const fim = new Date(agora);
    fim.setDate(fim.getDate() + 60);
    const paramFilter = buildParamFilter({
      StartDate: inicio.toISOString().slice(0, 19),
      EndDate: fim.toISOString().slice(0, 19),
    });

    // Pagina TODAS as páginas de `GET /tasks` (se qualquer página falhar, propaga → catch →
    // nenhuma escrita no banco, mesma guarda de `pcm-auvo-customers-import`).
    const tarefas = await auvoPaginate<AuvoTask>(
      (pageNumber, pageSize) =>
        auvoGet<AuvoTasksResponse>(
          `/tasks?${paramFilter}&page=${pageNumber}&pageSize=${pageSize}&order=asc`,
        ).then((r) => {
          if (Array.isArray(r?.result)) return r.result;
          if (Array.isArray(r?.result?.entityList)) return r.result.entityList;
          return [];
        }),
      { pageSize: DEFAULT_PAGE_SIZE },
    );

    // Só as tarefas SEM OS local correspondente entram no fluxo de criação — a query em lote evita
    // 1 SELECT por tarefa.
    const taskIds = tarefas.map(extractTaskId).filter((id): id is number => id != null);
    const existentes = new Set<number>();
    if (taskIds.length > 0) {
      const { data, error } = await db
        .schema("pcm")
        .from("ordens_servico")
        .select("auvo_task_id")
        .in("auvo_task_id", taskIds);
      if (error) throw error;
      for (const row of data ?? []) {
        if (row.auvo_task_id != null) existentes.add(row.auvo_task_id as number);
      }
    }

    // Classifica cada tarefa SEM I/O primeiro (mesmos 2 motivos de "ignorada" de antes: taskId
    // ausente/já existe, ou sem customerId) — só depois disso resolve cliente/numeração/autoria em
    // lote (1 query cada pro backfill inteiro, não 1 por tarefa). Antes disso era criarOsDaTarefa
    // por tarefa — 3 idas ao banco sequenciais cada — e um backfill de centenas de tarefas sozinho
    // já estourava o limite de 150s do Supabase quando chamado pelo botão "Sincronizar Auvo"
    // (achado testando em produção, 2026-07-08).
    let ignoradas = 0;
    const candidatas: Array<{ taskId: number; customerId: number; titulo: string; status: OsStatus }> = [];
    for (const tarefa of tarefas) {
      const taskId = extractTaskId(tarefa);
      if (taskId == null || existentes.has(taskId)) {
        ignoradas++;
        continue;
      }
      const customerId = tarefa.customerId;
      if (customerId == null) {
        ignoradas++;
        console.warn(JSON.stringify({ ts: now, nivel: "warn", fn: FN, reqId, msg: "tarefa Auvo sem customerId — ignorada", taskId }));
        continue;
      }
      const titulo = tarefa.title ?? tarefa.taskTitle ?? tarefa.description ?? `Tarefa Auvo ${taskId}`;
      const status = mapTaskStatusToOsStatus(tarefa.taskStatus ?? tarefa.status);
      candidatas.push({ taskId, customerId, titulo, status });
    }

    let criadas = 0;
    let semCliente = 0;
    if (candidatas.length > 0) {
      const [clienteIdsPorAuvoId, baseCount, systemUserId] = await Promise.all([
        resolverClienteIdsPorAuvoIds(db, candidatas.map((c) => c.customerId)),
        contarOsExistentes(db),
        obterUsuarioSistema(db),
      ]);

      const linhas: Array<Record<string, unknown>> = [];
      let sequencial = baseCount;
      for (const c of candidatas) {
        const clienteId = clienteIdsPorAuvoId.get(c.customerId);
        if (!clienteId) {
          semCliente++;
          console.warn(JSON.stringify({ ts: now, nivel: "warn", fn: FN, reqId, msg: "cliente ainda não sincronizado no PCM — tarefa pulada, tenta de novo na próxima rodada", taskId: c.taskId, customerId: c.customerId }));
          continue;
        }
        sequencial++;
        linhas.push(
          montarLinhaOs(
            { taskId: c.taskId, titulo: c.titulo, customerId: c.customerId, status: c.status },
            { clienteId, numero: formatarNumeroOs(sequencial), systemUserId },
          ),
        );
      }

      for (let i = 0; i < linhas.length; i += TAMANHO_LOTE_INSERT) {
        const lote = linhas.slice(i, i + TAMANHO_LOTE_INSERT);
        const { error } = await db.schema("pcm").from("ordens_servico").insert(lote);
        if (error) throw error;
        criadas += lote.length;
      }
    }

    const resultado = { pulled: tarefas.length, criadas, semCliente, ignoradas };
    console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, msg: "import de reconciliação concluído", ...resultado }));
    return json(200, resultado, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof AuvoApiError) {
      console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "falha Auvo", status: e.status, requestId: e.requestId }));
      return problem(502, `Auvo indisponível ou erro: ${e.message}`, reqId, cors);
    }
    console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors);
  }
});

export function extractTaskId(tarefa: AuvoTask): number | null {
  const candidato = tarefa.id ?? tarefa.taskId;
  return typeof candidato === "number" && Number.isFinite(candidato) ? candidato : null;
}

/** Mesmo espírito da máquina de transição de `pcm-auvo-webhook` (§2.14), simplificada porque o
 * import não tem `action` — só o `taskStatus` atual da tarefa. Sem status reconhecido (1=Aberta,
 * 6=Pausada, ou ausente), a OS nasce em `solicitacao` (AUTO-DECISION — estado inicial seguro). */
export function mapTaskStatusToOsStatus(taskStatus: number | undefined): OsStatus {
  if (taskStatus === AUVO_TASK_STATUS_FINALIZADA) return "finalizado";
  if (taskStatus != null && AUVO_TASK_STATUS_EM_ANDAMENTO.has(taskStatus)) return "em_execucao";
  return "solicitacao";
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function problem(status: number, detail: string, reqId: string, cors: Record<string, string>): Response {
  const titles: Record<number, string> = {
    401: "Unauthorized",
    405: "Method Not Allowed",
    500: "Internal Server Error",
    502: "Bad Gateway",
  };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
