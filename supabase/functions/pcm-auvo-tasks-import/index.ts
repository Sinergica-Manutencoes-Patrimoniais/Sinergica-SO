// pcm-auvo-tasks-import — reconciliação Auvo→PCM de Ordens de Serviço (E01-S34). Mesmo padrão de
// `pcm-auvo-customers-import` (E01-S13): pagina as tarefas do Auvo numa janela de data e cria a OS
// local para as que não têm `auvo_task_id` correspondente ainda. Janela padrão é pequena (rede de
// segurança pro que o webhook de Task perder, não backfill histórico — ver comentário na janela
// mais abaixo); `startDate`/`endDate` no corpo da requisição sobrescrevem pra um backfill
// pontual em fatias. Resolve cliente/numeração/autoria em LOTE (1 query cada pro lote inteiro) e
// faz insert em lote — diferente do webhook em tempo real (`pcm-auvo-webhook`, 1 tarefa por vez via
// `criarOsDaTarefa`), mas reaproveita a mesma montagem de linha (`montarLinhaOs`,
// _shared/auvo/os-from-task.ts) pra não duplicar o formato entre os dois.
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
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";
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
  resolverFuncionarioIdsPorAuvoIds,
} from "../_shared/auvo/os-from-task.ts";

/** Sobreposição de segurança do cursor incremental (E01-S67) — cobre tarefa retroagendada/
 * lançada com atraso no Auvo, que teria ficado fora de uma janela sem margem. */
const OVERLAP_DIAS_CURSOR = 3;
/** Janela de fallback quando não há nenhuma tarefa sincronizada ainda (bootstrap). */
const FALLBACK_DIAS_PASSADO = 14;

/** Máximo de linhas por `insert()` em lote — payload único grande demais é tão arriscado quanto
 * 1 round-trip por linha; fatiar mantém os dois lados saudáveis mesmo num backfill grande. */
const TAMANHO_LOTE_INSERT = 200;

const FN = "pcm-auvo-tasks-import";

const AUVO_TASK_STATUS_FINALIZADA = 5;
const AUVO_TASK_STATUS_EM_ANDAMENTO = new Set([2, 3, 4]);

interface AuvoTask {
  // Confirmado direto na API real (2026-07-09): o campo chama-se `taskID` (maiúsculo), não
  // `id`/`taskId` como este código assumia desde sempre — extractTaskId devolvia null pra TODA
  // tarefa, então 100% caía em "ignorada" e nenhuma OS nunca foi criada por aqui. Causa raiz real
  // do problema original ("tarefas do Auvo não viram OS"), não só o paramFilter/janela.
  taskID?: number;
  id?: number;
  taskId?: number;
  // `taskTypeDescription` é o campo com texto humano de verdade na resposta real (ex.: "INÍCIO
  // VISITA"); `title`/`description`/`taskTitle` não existem no payload real — mantidos como
  // fallback caso algum tipo de tarefa os traga.
  taskTypeDescription?: string;
  title?: string;
  description?: string;
  taskTitle?: string;
  customerId?: number;
  taskStatus?: number;
  status?: number;
  // E01-S38: dado rico da tarefa — confirmado direto na API real (2026-07-09). `idUserTo` é o
  // técnico responsável (timeline agrupa por ele); `taskDate`/`checkInDate`/`checkOutDate`
  // posicionam a OS no calendário/timeline; o resto vai em `auvo_detalhes` (jsonb), só exibição —
  // "traga todas as informações e detalhes das tarefas" (Lucas, 2026-07-09).
  idUserTo?: number;
  userToName?: string;
  taskDate?: string;
  checkInDate?: string;
  checkOutDate?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  priority?: number;
  orientation?: string;
  report?: string;
  pendency?: string;
  duration?: string;
  durationDecimal?: number;
  expense?: string;
  signatureUrl?: string;
  signatureName?: string;
  attachments?: unknown[];
  products?: unknown[];
  services?: unknown[];
  additionalCosts?: unknown[];
  summary?: Record<string, unknown>;
  ticketId?: number;
  ticketTitle?: string;
  customerDescription?: string;
  taskUrl?: string;
}

interface AuvoTasksResponse {
  result?: AuvoTask[] | {
    entityList?: AuvoTask[];
  };
}

interface RequestBody {
  /** Override opcional da janela padrão (ISO), usado só pro backfill histórico em fatias — ver
   * `runSyncAll`/script de backfill. Sem override, usa a janela padrão pequena (rede de segurança
   * do webhook, não backfill). */
  startDate?: string;
  endDate?: string;
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

    const body = (await req.json().catch(() => ({}))) as RequestBody;

    // `GET /tasks` EXIGE startDate/endDate (via paramFilter) quando customerId não é informado —
    // confirmado direto na API real (400 "Start date and end date are required when customerId is
    // not provided", errorCode 168).
    //
    // E01-S67: StartDate por CURSOR incremental (MAX(data_agendada) das OS já sincronizadas do
    // Auvo, menos 3 dias de sobreposição de segurança) em vez de janela fixa. Antes disso a janela
    // era sempre -14/+14 dias fixos, reprocessando dado que na maior parte das vezes já estava
    // sincronizado — mesma classe de causa raiz do incidente E01-S62 (`pull:tickets` com janela
    // fixa grande). Cursor incremental faz o custo por execução cair pra "poucos dias desde a
    // última rodada" em operação normal, o que torna seguro rodar de hora em hora (migration 0084)
    // em vez de só 1x/dia. Ver `specs/E01-S67-sync-incremental-background/design.md`.
    //
    // Overlap de 3 dias cobre tarefa retroagendada/lançada com atraso pelo técnico (o cursor já
    // teria avançado além dela numa rodada anterior sem essa margem). Fallback pra janela fixa
    // antiga (-14 dias) só no bootstrap (nenhuma tarefa sincronizada ainda) — sem regressão nesse
    // caso. EndDate continua fixo (+14 dias) — forward window já era pequeno, não muda.
    const agora = new Date();
    const fimPadrao = new Date(agora);
    fimPadrao.setDate(fimPadrao.getDate() + 14);
    const startDate = body.startDate ?? (await calcularInicioJanela(db, agora)).toISOString().slice(0, 19);
    const paramFilter = buildParamFilter({
      StartDate: startDate,
      EndDate: body.endDate ?? fimPadrao.toISOString().slice(0, 19),
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

    // Classifica cada tarefa SEM I/O primeiro (taskId ausente é o único motivo de "ignorada" puro
    // agora — tarefa já existente vira ENRIQUECIMENTO, não é mais pulada sem revisitar; E01-S38,
    // achado ao rodar o backfill retroativo: tasks-import só inseria tarefa nova, então as OS já
    // existentes nunca ganhavam técnico/data/check-in-out mesmo depois da migration). Só depois
    // resolve cliente/técnico/numeração/autoria em LOTE (1 query cada pro lote inteiro, não 1 por
    // tarefa) — motivo já documentado em E01-S34 (estourava 150s do Supabase 1 por 1).
    let ignoradas = 0;
    const comTaskId: Array<{
      taskId: number;
      jaExiste: boolean;
      customerId: number | null;
      titulo: string;
      status: OsStatus;
      tecnicoAuvoUserId: number | null;
      dataAgendada: string | null;
      checkInAt: string | null;
      checkOutAt: string | null;
      detalhes: Record<string, unknown>;
    }> = [];
    for (const tarefa of tarefas) {
      const taskId = extractTaskId(tarefa);
      if (taskId == null) {
        ignoradas++;
        continue;
      }
      comTaskId.push({
        taskId,
        jaExiste: existentes.has(taskId),
        customerId: tarefa.customerId ?? null,
        titulo: tarefa.taskTypeDescription ?? tarefa.title ?? tarefa.taskTitle ?? tarefa.description ?? `Tarefa Auvo ${taskId}`,
        status: mapTaskStatusToOsStatus(tarefa.taskStatus ?? tarefa.status),
        tecnicoAuvoUserId: tarefa.idUserTo ?? null,
        dataAgendada: tarefa.taskDate ?? null,
        checkInAt: tarefa.checkInDate ?? null,
        checkOutAt: tarefa.checkOutDate ?? null,
        detalhes: montarDetalhes(tarefa),
      });
    }

    const candidatas = comTaskId.filter((t) => !t.jaExiste);
    const paraEnriquecer = comTaskId.filter((t) => t.jaExiste);

    const tecnicoAuvoUserIds = comTaskId
      .map((t) => t.tecnicoAuvoUserId)
      .filter((id): id is number => id != null);
    const funcionarioIdsPorAuvoId = await resolverFuncionarioIdsPorAuvoIds(db, tecnicoAuvoUserIds);

    let criadas = 0;
    let semCliente = 0;
    if (candidatas.length > 0) {
      const candidatasComCliente = candidatas.filter(
        (c): c is typeof c & { customerId: number } => c.customerId != null,
      );
      for (const c of candidatas) {
        if (c.customerId == null) {
          ignoradas++;
          console.warn(JSON.stringify({ ts: now, nivel: "warn", fn: FN, reqId, msg: "tarefa Auvo sem customerId — ignorada", taskId: c.taskId }));
        }
      }

      const [clienteIdsPorAuvoId, baseCount, systemUserId] = await Promise.all([
        resolverClienteIdsPorAuvoIds(db, candidatasComCliente.map((c) => c.customerId)),
        contarOsExistentes(db),
        obterUsuarioSistema(db),
      ]);

      const linhas: Array<Record<string, unknown>> = [];
      let sequencial = baseCount;
      for (const c of candidatasComCliente) {
        const clienteId = clienteIdsPorAuvoId.get(c.customerId);
        if (!clienteId) {
          semCliente++;
          console.warn(JSON.stringify({ ts: now, nivel: "warn", fn: FN, reqId, msg: "cliente ainda não sincronizado no PCM — tarefa pulada, tenta de novo na próxima rodada", taskId: c.taskId, customerId: c.customerId }));
          continue;
        }
        sequencial++;
        const tecnicoFuncionarioId = c.tecnicoAuvoUserId != null
          ? funcionarioIdsPorAuvoId.get(c.tecnicoAuvoUserId) ?? null
          : null;
        linhas.push(
          montarLinhaOs(
            {
              taskId: c.taskId,
              titulo: c.titulo,
              customerId: c.customerId,
              status: c.status,
              tecnicoAuvoUserId: c.tecnicoAuvoUserId,
              dataAgendada: c.dataAgendada,
              checkInAt: c.checkInAt,
              checkOutAt: c.checkOutAt,
              detalhes: c.detalhes,
            },
            { clienteId, numero: formatarNumeroOs(sequencial), systemUserId, tecnicoFuncionarioId },
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

    // E01-S38: enriquece as OS que JÁ existem (não recria, não mexe em status/título/cliente) —
    // 1 RPC pro lote inteiro (`fn_enriquecer_os_em_lote`, migration 0072), não 1 UPDATE por linha.
    let enriquecidas = 0;
    if (paraEnriquecer.length > 0) {
      const atualizacoes = paraEnriquecer.map((t) => ({
        auvo_task_id: t.taskId,
        tecnico_auvo_user_id: t.tecnicoAuvoUserId,
        tecnico_funcionario_id: t.tecnicoAuvoUserId != null
          ? funcionarioIdsPorAuvoId.get(t.tecnicoAuvoUserId) ?? null
          : null,
        data_agendada: t.dataAgendada,
        check_in_at: t.checkInAt,
        check_out_at: t.checkOutAt,
        auvo_detalhes: t.detalhes,
      }));
      for (let i = 0; i < atualizacoes.length; i += TAMANHO_LOTE_INSERT) {
        const lote = atualizacoes.slice(i, i + TAMANHO_LOTE_INSERT);
        const { data, error } = await db.schema("pcm").rpc("fn_enriquecer_os_em_lote", {
          p_atualizacoes: lote,
        });
        if (error) throw error;
        enriquecidas += Number(data ?? 0);
      }
    }

    const resultado = { pulled: tarefas.length, criadas, enriquecidas, semCliente, ignoradas };
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

/** Dado rico da tarefa que só serve pra exibição (nunca WHERE/ORDER BY/GROUP BY) — vai em
 * `auvo_detalhes` (jsonb). Só inclui chaves presentes/não-vazias no payload real, sem inventar
 * default — "traga todas as informações e detalhes das tarefas" (Lucas, 2026-07-09). */
export function montarDetalhes(tarefa: AuvoTask): Record<string, unknown> {
  const detalhes: Record<string, unknown> = {};
  if (tarefa.address) detalhes.address = tarefa.address;
  if (tarefa.latitude != null) detalhes.latitude = tarefa.latitude;
  if (tarefa.longitude != null) detalhes.longitude = tarefa.longitude;
  if (tarefa.priority != null) detalhes.priority = tarefa.priority;
  if (tarefa.userToName) detalhes.tecnicoNomeAuvo = tarefa.userToName;
  if (tarefa.customerDescription) detalhes.clienteNomeAuvo = tarefa.customerDescription;
  if (tarefa.orientation) detalhes.orientacao = tarefa.orientation;
  if (tarefa.report) detalhes.relato = tarefa.report;
  if (tarefa.pendency) detalhes.pendencia = tarefa.pendency;
  if (tarefa.duration) detalhes.duracao = tarefa.duration;
  if (tarefa.durationDecimal != null) detalhes.duracaoHoras = tarefa.durationDecimal;
  if (tarefa.expense) detalhes.despesa = tarefa.expense;
  if (tarefa.signatureUrl) detalhes.assinaturaUrl = tarefa.signatureUrl;
  if (tarefa.signatureName) detalhes.assinaturaNome = tarefa.signatureName;
  if (Array.isArray(tarefa.attachments) && tarefa.attachments.length > 0) {
    detalhes.anexos = tarefa.attachments;
  }
  if (Array.isArray(tarefa.products) && tarefa.products.length > 0) {
    detalhes.produtos = tarefa.products;
  }
  if (Array.isArray(tarefa.services) && tarefa.services.length > 0) {
    detalhes.servicos = tarefa.services;
  }
  if (Array.isArray(tarefa.additionalCosts) && tarefa.additionalCosts.length > 0) {
    detalhes.custosAdicionais = tarefa.additionalCosts;
  }
  if (tarefa.summary) detalhes.resumo = tarefa.summary;
  if (tarefa.ticketId) detalhes.ticketId = tarefa.ticketId;
  if (tarefa.ticketTitle) detalhes.ticketTitulo = tarefa.ticketTitle;
  if (tarefa.taskUrl) detalhes.taskUrl = tarefa.taskUrl;
  return detalhes;
}

/** Busca `MAX(data_agendada)` das OS já sincronizadas do Auvo — o cursor incremental. `null` no
 * bootstrap (nenhuma tarefa sincronizada ainda), quem chama decide o fallback. */
async function buscarCursorMaxDataAgendada(db: UntypedSupabaseClient): Promise<string | null> {
  const { data, error } = await db
    .schema("pcm")
    .from("ordens_servico")
    .select("data_agendada")
    .not("auvo_task_id", "is", null)
    .not("data_agendada", "is", null)
    .order("data_agendada", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.data_agendada as string | undefined) ?? null;
}

/** Função pura: dado o cursor (string ISO ou null) e "agora", calcula o `StartDate` da janela.
 * `null` (bootstrap) cai no fallback fixo antigo; cursor presente usa `cursor - overlap`. */
export function calcularInicioJanelaDeCursor(cursorMax: string | null, agora: Date): Date {
  if (cursorMax == null) {
    const inicio = new Date(agora);
    inicio.setDate(inicio.getDate() - FALLBACK_DIAS_PASSADO);
    return inicio;
  }
  const inicio = new Date(cursorMax);
  inicio.setDate(inicio.getDate() - OVERLAP_DIAS_CURSOR);
  return inicio;
}

async function calcularInicioJanela(db: UntypedSupabaseClient, agora: Date): Promise<Date> {
  const cursorMax = await buscarCursorMaxDataAgendada(db);
  return calcularInicioJanelaDeCursor(cursorMax, agora);
}

export function extractTaskId(tarefa: AuvoTask): number | null {
  const candidato = tarefa.taskID ?? tarefa.id ?? tarefa.taskId;
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
