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
import { HttpError } from "../_shared/auth.ts";
import { validateAuvoSignature } from "../_shared/auvo/verify-signature.ts";

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

    // 5) Só `entity=Task` é processado — outras entidades são fora de escopo desta story
    // (Customer/User/Equipment, ver spec.md → Fora de escopo). No-op silencioso, 200.
    if (evento.entity !== AUVO_ENTITY_TASK) {
      console.log(JSON.stringify({ ...logBase, nivel: "info", msg: "entity fora de escopo, ignorado", entity: evento.entity }));
      return json(200, { ok: true, ignored: true, reason: "entity_out_of_scope" }, cors);
    }

    // 6) Resolve o taskId do Auvo referenciado pelo evento — defensivo quanto ao nome do campo
    // (shape de entrega não confirmado neste ambiente, ver nota no topo do arquivo).
    const taskId = extractTaskId(evento);
    if (taskId == null) {
      console.warn(JSON.stringify({ ...logBase, nivel: "warn", msg: "evento de Task sem taskId reconhecível — ignorado", rawBody: rawBody.slice(0, 2000) }));
      return json(200, { ok: true, ignored: true, reason: "task_id_not_found" }, cors);
    }

    // 7) Máquina de transição de status (AC-2, AC-3, AC-4). Ver SPEC_DEVIATION em tasks.md: o
    // mapeamento action=3 (Exclusão) → cancelado é uma inferência, não um taskStatus documentado.
    const targetStatus = resolveTargetStatus(evento, taskId, logBase);
    if (targetStatus == null) {
      console.log(JSON.stringify({ ...logBase, nivel: "info", msg: "evento de Task sem transição de status mapeada — ignorado", action: evento.action, taskId }));
      return json(200, { ok: true, ignored: true, reason: "no_status_transition" }, cors);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // 8) Resolve a OS pelo auvo_task_id — AC-6: taskId desconhecido nunca derruba o endpoint.
    const { data: os, error: osError } = await db
      .schema("pcm")
      .from("ordens_servico")
      .select("id, status, categoria, auvo_task_id")
      .eq("auvo_task_id", taskId)
      .maybeSingle();
    if (osError) throw osError;

    if (!os) {
      console.warn(JSON.stringify({ ...logBase, nivel: "warn", msg: "auvo_task_id sem OS correspondente — ignorado (AC-6)", taskId }));
      return json(200, { ok: true, ignored: true, reason: "unknown_task_id", taskId }, cors);
    }

    // 9) AC-5: UPDATE idempotente — só transiciona se a OS não estiver já no status alvo. Uma
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

    const transicionou = updated != null;
    console.log(
      JSON.stringify({
        ...logBase,
        nivel: "info",
        msg: transicionou ? "OS transicionada" : "OS já estava no status alvo (idempotente, no-op)",
        osId: os.id,
        taskId,
        statusAnterior: os.status,
        statusAlvo: targetStatus,
      }),
    );

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

    return json(200, { ok: true, osId: os.id, taskId, status: targetStatus, transitioned: transicionou }, cors);
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
