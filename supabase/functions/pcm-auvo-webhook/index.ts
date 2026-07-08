// pcm-auvo-webhook — recebe eventos de Task do Auvo (execução, conclusão, exclusão) e atualiza
// `pcm.ordens_servico.status` correspondente, encontrada por `auvo_task_id`.
// AC-1 a AC-7 de specs/E01-S10-integracao-auvo-webhook-status/spec.md.
//
// DIFERENÇA em relação a `pcm-auvo-create-task`/`pcm-auvo-customers-sync`: esta função é chamada
// PELO Auvo (terceiro externo), não pelo trigger `pg_net` do próprio sistema — por isso NÃO usa
// `requireServiceRole` (_shared/auth.ts, reservado para chamada sistema→sistema). A autenticação
// aqui é a assinatura HMAC do header `X-Auvo-Signature` (_shared/auvo/verify-signature.ts), com o
// secret em `AUVO_WEBHOOK_SECRET` (Supabase Vault em produção).
//
// NÃO VERIFICADO NESTE AMBIENTE: sem Deno CLI aqui, este código não foi type-checked nem
// executado contra um webhook real do Auvo. Dois pontos exigem confirmação antes de produção
// (ver SPEC_DEVIATION em tasks.md):
//   1. O shape exato do payload de entrega do webhook (nomes de campo `id`/`taskId`/`entityId`,
//      `taskStatus`) — a função abaixo é DEFENSIVA (tenta múltiplos nomes de campo plausíveis)
//      justamente por essa incerteza.
//   2. O mapeamento action=3 (Exclusão) → OS `cancelado` é uma inferência (não há taskStatus
//      "Cancelada" documentado) — ver SPEC_DEVIATION.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError } from "../_shared/auth.ts";
import { validateAuvoSignature } from "../_shared/auvo/verify-signature.ts";
import { byWebhookEntity } from "../_shared/auvo/registry/index.ts";
import type { AuvoEntityDescriptor } from "../_shared/auvo/registry/types.ts";
import { resolveWebhookDispatch } from "../_shared/auvo/webhook-dispatch.ts";
import { criarOsDaTarefa } from "../_shared/auvo/os-from-task.ts";

const FN = "pcm-auvo-webhook";

// Enums do webhook Auvo (não documentados via SDK — vêm do mapeamento consultado no estudo da
// story, ver spec.md → Rastreabilidade §3.6/3.7). Só `entity=Task` é processado aqui (Fora de
// escopo da spec: Customer/User/Equipment ficam para outras stories/via API).
const AUVO_ENTITY_TASK = 4;
const AUVO_ACTION_ALTERACAO = 2;
const AUVO_ACTION_EXCLUSAO = 3;

// taskStatus documentado em Auvo-API-Mapeamento-Completo.md §2.14 (6 valores, sem "Cancelada"):
// 1=Aberta, 2=Em Deslocamento, 3=Check-in Realizado, 4=Check-out Realizado, 5=Finalizada, 6=Pausada.
const AUVO_TASK_STATUS_FINALIZADA = 5;
const AUVO_TASK_STATUS_EM_ANDAMENTO = new Set([2, 3, 4]); // deslocamento/check-in/check-out

type OsStatus = "em_execucao" | "finalizado" | "cancelado";
type JsonObject = Record<string, unknown>;

// Schema deliberadamente leniente: só exige `entity`/`action` numéricos (coagidos, o Auvo pode
// mandar como string). O resto do payload é validado/extraído defensivamente em runtime — ver
// `extractTaskId`/`extractTaskStatus` — porque o shape exato de entrega não está confirmado neste
// ambiente (a doc do Auvo mostra o shape do REGISTRO do webhook, não necessariamente da ENTREGA).
const WebhookEventSchema = z
  .object({
    entity: z.coerce.number(),
    action: z.coerce.number(),
  })
  .passthrough();

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  const logBase = { ts: new Date().toISOString(), fn: FN, reqId };
  console.log(JSON.stringify({ ...logBase, nivel: "info", msg: "webhook recebido", method: req.method }));

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");

    // 1) Corpo bruto (string) — a assinatura é calculada sobre o corpo bruto, ANTES do parse
    // JSON (AC-1). Ler como texto primeiro, nunca `req.json()` direto aqui.
    const rawBody = await req.text();

    // 2) AC-1: valida assinatura HMAC-SHA256 antes de processar qualquer coisa. Loga mesmo os
    // eventos rejeitados por assinatura (task 8 de tasks.md — log estruturado de todo evento).
    const secret = Deno.env.get("AUVO_WEBHOOK_SECRET") ?? "";
    const signatureHeader = req.headers.get("X-Auvo-Signature");
    const signatureOk = await validateAuvoSignature(secret, rawBody, signatureHeader);
    if (!signatureOk) {
      console.warn(
        JSON.stringify({ ...logBase, nivel: "warn", msg: "assinatura inválida — requisição rejeitada", hasHeader: signatureHeader != null }),
      );
      throw new HttpError(401, "Assinatura inválida");
    }

    // 3) Corpo malformado (não é JSON válido) — Casos de borda da spec: responde 400, loga o
    // corpo bruto para diagnóstico, nunca derruba a função.
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error(JSON.stringify({ ...logBase, nivel: "error", msg: "corpo do webhook não é JSON válido", rawBody: rawBody.slice(0, 2000) }));
      throw new HttpError(400, "Corpo do webhook não é JSON válido");
    }

    // 4) Validação leniente do shape (AC-6 espírito: nunca 500, nunca crasha por payload
    // inesperado). Se nem `entity`/`action` numéricos existem, trata como evento não reconhecido
    // — loga e confirma recebimento (200), não fica em 400 (400 faria o Auvo reentregar para
    // sempre um payload que nunca vai ficar "certo").
    const parsed = WebhookEventSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn(
        JSON.stringify({ ...logBase, nivel: "warn", msg: "payload de webhook com shape não reconhecido — ignorado", rawBody: rawBody.slice(0, 2000) }),
      );
      return json(200, { ok: true, ignored: true, reason: "unrecognized_payload" }, cors);
    }
    const evento = parsed.data;

    // 5) E01-S23: entidades novas passam pelo dispatcher genérico do registry. `entity=Task`
    // continua no handler legado abaixo, sem alterar sua semântica (AC-4 de E01-S23).
    if (evento.entity !== AUVO_ENTITY_TASK) {
      const descriptor = byWebhookEntity(evento.entity) as
        | AuvoEntityDescriptor<Record<string, unknown>, Record<string, unknown>>
        | undefined;
      if (descriptor) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceKey = getSupabaseServiceKey();
        if (!supabaseUrl || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");
        const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const decision = resolveWebhookDispatch(evento, descriptor);

        if (decision.action === "ignore") {
          console.log(JSON.stringify({ ...logBase, nivel: "info", msg: "webhook ignorado pelo dispatcher genérico", entity: evento.entity, reason: decision.reason }));
          return json(200, { ok: true, ignored: true, reason: decision.reason }, cors);
        }

        const { data: rowId, error } = await db.schema("pcm").rpc("fn_upsert_auvo_sync", {
          p_table: descriptor.pcmTable,
          p_auvo_id: String(decision.auvoId),
          p_patch: decision.patch,
        });
        if (error) throw error;

        console.log(
          JSON.stringify({
            ...logBase,
            nivel: "info",
            msg: "webhook aplicado pelo dispatcher genérico",
            entity: evento.entity,
            descriptor: descriptor.key,
            action: decision.action,
            auvoId: decision.auvoId,
            rowId,
          }),
        );
        return json(200, { ok: true, entity: descriptor.key, action: decision.action, rowId }, cors);
      }
    }

    // 6) Só `entity=Task` segue no caminho legado. Outras entidades sem descriptor são no-op
    // silencioso, 200, para o Auvo não reentregar para sempre.
    if (evento.entity !== AUVO_ENTITY_TASK) {
      console.log(JSON.stringify({ ...logBase, nivel: "info", msg: "entity fora de escopo, ignorado", entity: evento.entity }));
      return json(200, { ok: true, ignored: true, reason: "entity_out_of_scope" }, cors);
    }

    // 7) Resolve o taskId do Auvo referenciado pelo evento — defensivo quanto ao nome do campo
    // (shape de entrega não confirmado neste ambiente, ver nota no topo do arquivo).
    const taskId = extractTaskId(evento);
    if (taskId == null) {
      console.warn(JSON.stringify({ ...logBase, nivel: "warn", msg: "evento de Task sem taskId reconhecível — ignorado", rawBody: rawBody.slice(0, 2000) }));
      return json(200, { ok: true, ignored: true, reason: "task_id_not_found" }, cors);
    }

    // 8) Máquina de transição de status (AC-2, AC-3, AC-4). Ver SPEC_DEVIATION em tasks.md: o
    // mapeamento action=3 (Exclusão) → cancelado é uma inferência, não um taskStatus documentado.
    const targetStatus = resolveTargetStatus(evento, taskId, logBase);
    if (targetStatus == null) {
      console.log(JSON.stringify({ ...logBase, nivel: "info", msg: "evento de Task sem transição de status mapeada — ignorado", action: evento.action, taskId }));
      return json(200, { ok: true, ignored: true, reason: "no_status_transition" }, cors);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!supabaseUrl || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // 9) Resolve a OS pelo auvo_task_id — AC-6: taskId desconhecido nunca derruba o endpoint.
    const { data: osExistente, error: osError } = await db
      .schema("pcm")
      .from("ordens_servico")
      .select("id, status, categoria, auvo_task_id")
      .eq("auvo_task_id", taskId)
      .maybeSingle();
    if (osError) throw osError;

    let os: { id: string; status: string; categoria: string };
    let transicionou: boolean;
    let criadaAgora = false;

    if (!osExistente) {
      // E01-S34: tarefa nova criada direto no Auvo (sem OS local ainda) — tenta criar em vez de
      // só ignorar (AC-3/AC-4). Zero mudança no caminho de OS já conhecida abaixo (AC-6).
      const customerId = extractCustomerId(evento);
      if (customerId == null) {
        console.warn(JSON.stringify({ ...logBase, nivel: "warn", msg: "auvo_task_id sem OS correspondente e sem customerId no payload — ignorado", taskId }));
        return json(200, { ok: true, ignored: true, reason: "unknown_task_id_no_customer", taskId }, cors);
      }
      const titulo = extractTitle(evento, taskId);
      const criada = await criarOsDaTarefa(db, { taskId, titulo, customerId, status: targetStatus });
      if (!criada) {
        console.warn(JSON.stringify({ ...logBase, nivel: "warn", msg: "tarefa nova do Auvo, mas cliente ainda não sincronizado no PCM — ignorado (AC-4, pego depois pelo import de reconciliação)", taskId, customerId }));
        return json(200, { ok: true, ignored: true, reason: "customer_not_synced", taskId, customerId }, cors);
      }
      os = { id: criada.id, status: criada.status, categoria: "corretiva" };
      transicionou = true;
      criadaAgora = true;
      console.log(JSON.stringify({ ...logBase, nivel: "info", msg: "OS criada a partir de tarefa Auvo desconhecida (AC-3)", osId: os.id, taskId, status: targetStatus }));
    } else {
      // 10) AC-5: UPDATE idempotente — só transiciona se a OS não estiver já no status alvo. Uma
      // reentrega do mesmo evento (retry de rede do Auvo) não gera erro, só confirma (0 linhas
      // afetadas = já estava no estado certo, tratado como sucesso, não como falha).
      const { data: updated, error: updateError } = await db
        .schema("pcm")
        .from("ordens_servico")
        .update({ status: targetStatus, updated_at: new Date().toISOString() })
        .eq("auvo_task_id", taskId)
        .neq("status", targetStatus)
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;

      os = osExistente;
      transicionou = updated != null;
      console.log(
        JSON.stringify({
          ...logBase,
          nivel: "info",
          msg: transicionou ? "OS transicionada" : "OS já estava no status alvo (idempotente, no-op)",
          osId: os.id,
          taskId,
          statusAnterior: osExistente.status,
          statusAlvo: targetStatus,
        }),
      );
    }

    // E01-S15: captura rica do webhook. Não copia anexos/fotos para Storage; guarda metadados,
    // URLs/referências do Auvo quando existirem, e sempre preserva o payload bruto.
    await upsertTaskSnapshot(db, os.id, taskId, payload, targetStatus);

    // E01-S16: relacionamento OS ↔ equipamento Auvo. O PCM NÃO duplica identificador/categoria/
    // garantia do equipamento; guarda apenas o vínculo de domínio PCM quando o payload trouxer ID.
    const auvoEquipmentId = extractEquipmentId(evento);
    if (auvoEquipmentId != null) {
      const { error: equipmentLinkError } = await db
        .schema("pcm")
        .from("os_equipamentos_auvo")
        .upsert(
          {
            ordem_servico_id: os.id,
            auvo_equipment_id: auvoEquipmentId,
            source: "auvo_webhook",
            payload_ref: { taskId },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "ordem_servico_id,auvo_equipment_id" },
        );
      if (equipmentLinkError) throw equipmentLinkError;
    }

    // AC-7: OS preventiva de climatização concluída deveria disparar criação de registro PMOC
    // (pcm.pmoc_records) — spec.md AC-7. PMOC (E01-S03..S08) ainda não tem essa tabela no schema
    // (ROADMAP: "Planejado"). Criar a tabela aqui seria decisão arquitetural de outra story, fora
    // do escopo deste dev. Registrado como SPEC_DEVIATION em tasks.md.
    // SPEC_DEVIATION: AC-7 não implementado — pcm.pmoc_records não existe ainda (PMOC não
    // construído). Loga aviso estruturado e segue sem criar o registro; ver tasks.md.
    if (targetStatus === "finalizado" && os.categoria === "preventiva") {
      console.warn(
        JSON.stringify({
          ...logBase,
          nivel: "warn",
          msg: "SPEC_DEVIATION AC-7: OS preventiva concluída, mas criação de pcm.pmoc_records está deferida (tabela ainda não existe — PMOC não implementado, ver ROADMAP)",
          osId: os.id,
          taskId,
        }),
      );
    }

    return json(200, { ok: true, osId: os.id, taskId, status: targetStatus, transitioned: transicionou, created: criadaAgora }, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    console.error(JSON.stringify({ ...logBase, nivel: "error", msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors); // nunca vaza stack
  }
});

/** Extrai o `taskId` do Auvo do payload do evento, tentando os nomes de campo plausíveis (shape
 * de entrega do webhook não confirmado neste ambiente — ver nota no topo do arquivo). */
function extractTaskId(evento: Record<string, unknown>): number | null {
  const candidatos = [evento.id, evento.taskId, evento.entityId];
  for (const c of candidatos) {
    if (typeof c === "number" && Number.isFinite(c)) return c;
    if (typeof c === "string" && /^\d+$/.test(c)) return Number(c);
  }
  return null;
}

/** Extrai o `taskStatus` do Auvo do payload do evento, tentando os nomes de campo plausíveis. */
function extractTaskStatus(evento: Record<string, unknown>): number | null {
  const candidatos = [evento.taskStatus, evento.status];
  for (const c of candidatos) {
    if (typeof c === "number" && Number.isFinite(c)) return c;
    if (typeof c === "string" && /^\d+$/.test(c)) return Number(c);
  }
  return null;
}

/** E01-S34: extrai o `customerId` do Auvo do payload do evento (defensivo — shape de entrega não
 * confirmado, mesmo espírito de `extractEquipmentId`). `null` = payload não trouxe cliente, tarefa
 * fica ignorada (AC-3 exige customerId pra resolver `client_id`). */
function extractCustomerId(evento: Record<string, unknown>): number | null {
  const candidatos = [
    evento.customerId,
    evento.customer_id,
    valueAtPath(evento, ["customer", "id"]),
    valueAtPath(evento, ["cliente", "id"]),
    valueAtPath(evento, ["task", "customerId"]),
    valueAtPath(evento, ["result", "customerId"]),
  ];
  return firstNumber(candidatos);
}

/** E01-S34: título da OS nova — defensivo quanto ao nome do campo; fallback sempre não-vazio
 * porque `pcm.ordens_servico.titulo` é `NOT NULL`. */
function extractTitle(evento: Record<string, unknown>, taskId: number): string {
  const candidatos = [
    deepFind(evento, ["title", "titulo", "description", "descricao", "taskTitle", "name"]),
  ];
  return firstString(candidatos) ?? `Tarefa Auvo ${taskId}`;
}

function extractEquipmentId(evento: Record<string, unknown>): number | null {
  const candidatos = [
    evento.equipmentId,
    evento.auvoEquipmentId,
    evento.equipment_id,
    valueAtPath(evento, ["equipment", "id"]),
    valueAtPath(evento, ["equipamento", "id"]),
    valueAtPath(evento, ["task", "equipmentId"]),
    valueAtPath(evento, ["result", "equipmentId"]),
  ];
  return firstNumber(candidatos);
}

async function upsertTaskSnapshot(
  db: ReturnType<typeof createClient>,
  osId: string,
  taskId: number,
  payload: unknown,
  targetStatus: OsStatus,
): Promise<void> {
  const root = isObject(payload) ? payload : {};
  const now = new Date().toISOString();
  const timeline = normalizeTimeline(root);
  const { error } = await db
    .schema("pcm")
    .from("auvo_task_snapshots")
    .upsert(
      {
        ordem_servico_id: osId,
        auvo_task_id: taskId,
        payload_raw: payload,
        relato_usuario: firstString([
          deepFind(root, ["userReport", "user_report", "relatoUsuario", "relato_usuario", "report", "description", "descricao", "orientation"]),
        ]),
        anexos: firstArray([
          deepFind(root, ["attachments", "anexos", "files", "fotos", "photos", "images"]),
        ]),
        checklist: firstArray([
          deepFind(root, ["checklist", "questionnaire", "questionario", "questions", "answers", "respostas"]),
        ]),
        pecas_consumidas: firstArray([
          deepFind(root, ["parts", "pieces", "materials", "pecas", "pecasConsumidas", "materiais"]),
        ]),
        controle_horas: firstObject([
          deepFind(root, ["hours", "workHours", "controleHoras", "timeTracking", "timesheet"]),
        ]),
        timeline,
        recebida_em: timeline.recebida_em ?? null,
        visualizada_em: timeline.visualizada_em ?? null,
        checkin_em: timeline.checkin_em ?? null,
        checkout_em: timeline.checkout_em ?? null,
        concluida_em: timeline.concluida_em ?? (targetStatus === "finalizado" ? now : null),
        last_webhook_received_at: now,
        updated_at: now,
      },
      { onConflict: "auvo_task_id" },
    );
  if (error) throw error;
}

function normalizeTimeline(root: JsonObject): JsonObject {
  const timelineObject = firstObject([deepFind(root, ["timeline", "events", "history", "historico"])]);
  const source = timelineObject && Object.keys(timelineObject).length > 0 ? timelineObject : root;
  return {
    raw: timelineObject,
    recebida_em: firstIsoString([
      deepFind(source, ["receivedAt", "received_at", "recebidaEm", "recebida_em", "dataRecebida"]),
    ]),
    visualizada_em: firstIsoString([
      deepFind(source, ["viewedAt", "viewed_at", "visualizadaEm", "visualizada_em", "dataVisualizada"]),
    ]),
    checkin_em: firstIsoString([
      deepFind(source, ["checkInAt", "checkinAt", "check_in_at", "checkin", "checkIn", "dataCheckIn"]),
    ]),
    checkout_em: firstIsoString([
      deepFind(source, ["checkOutAt", "checkoutAt", "check_out_at", "checkout", "checkOut", "dataCheckOut"]),
    ]),
    concluida_em: firstIsoString([
      deepFind(source, ["finishedAt", "completedAt", "concludedAt", "concluidaEm", "finalizadaEm", "dataConclusao"]),
    ]),
  };
}

function deepFind(root: unknown, names: string[]): unknown {
  if (!isObject(root)) return undefined;
  for (const name of names) {
    if (root[name] != null) return root[name];
  }
  for (const container of ["task", "result", "data", "payload"]) {
    const nested = root[container];
    if (isObject(nested)) {
      const value = deepFind(nested, names);
      if (value != null) return value;
    }
  }
  return undefined;
}

function valueAtPath(root: unknown, path: string[]): unknown {
  let current = root;
  for (const part of path) {
    if (!isObject(current)) return undefined;
    current = current[part];
  }
  return current;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
}

function firstIsoString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
    if (typeof value === "number" && Number.isFinite(value)) {
      const ms = value > 10_000_000_000 ? value : value * 1000;
      const date = new Date(ms);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  return null;
}

function firstArray(values: unknown[]): unknown[] {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function firstObject(values: unknown[]): JsonObject {
  for (const value of values) {
    if (isObject(value)) return value;
  }
  return {};
}

function firstNumber(values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  }
  return null;
}

/**
 * Máquina de transição Auvo → `pcm.ordens_servico.status` (AC-2, AC-3, AC-4).
 * SPEC_DEVIATION (ver tasks.md): o taskStatus documentado do Auvo (§2.14) não tem valor
 * "Cancelada" — só 1=Aberta, 2=Em Deslocamento, 3=Check-in Realizado, 4=Check-out Realizado,
 * 5=Finalizada, 6=Pausada. Mapeamento adotado, a confirmar contra um webhook real antes de
 * produção:
 *   - action=2 (Alteração) + taskStatus=5 (Finalizada)      → 'finalizado' (AC-2)
 *   - action=2 (Alteração) + taskStatus em {2,3,4}           → 'em_execucao' (AC-3)
 *   - action=3 (Exclusão) da task                            → 'cancelado' (AC-4, inferido)
 */
function resolveTargetStatus(
  evento: Record<string, unknown>,
  taskId: number,
  logBase: Record<string, unknown>,
): OsStatus | null {
  if (evento.action === AUVO_ACTION_EXCLUSAO) {
    return "cancelado";
  }

  if (evento.action === AUVO_ACTION_ALTERACAO) {
    const taskStatus = extractTaskStatus(evento);
    if (taskStatus === AUVO_TASK_STATUS_FINALIZADA) return "finalizado";
    if (taskStatus != null && AUVO_TASK_STATUS_EM_ANDAMENTO.has(taskStatus)) return "em_execucao";
    console.log(
      JSON.stringify({ ...logBase, nivel: "info", msg: "Alteração de Task sem taskStatus mapeado — ignorado", taskId, taskStatus }),
    );
    return null;
  }

  // Outras ações (ex.: action=1 Inclusão) são fora de escopo — a task só existe no Auvo porque o
  // PCM já a criou (E01-S09); nada a fazer aqui além de confirmar recebimento.
  return null;
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function problem(status: number, detail: string, reqId: string, cors: Record<string, string>): Response {
  const titles: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    405: "Method Not Allowed",
    500: "Internal Server Error",
  };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
