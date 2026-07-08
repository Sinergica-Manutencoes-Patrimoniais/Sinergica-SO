// pcm-whatsapp-webhook — entrada Evolution API/WhatsApp para o Agente Zé (E01-S02).
// Valida HMAC, persiste atendimento.wa_messages e enfileira atendimento.wa_queue com delay de 3s.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError } from "../_shared/auth.ts";
import { constantTimeEqual } from "../_shared/crypto.ts";

const FN = "pcm-whatsapp-webhook";

const EvolutionWebhookSchema = z.object({}).passthrough();

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });
  const reqId = crypto.randomUUID().slice(0, 8);

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");

    const rawBody = await req.text();
    if (!(await validateEvolutionSignature(req, rawBody))) {
      throw new HttpError(401, "Assinatura inválida");
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new HttpError(400, "JSON inválido");
    }
    const payload = EvolutionWebhookSchema.parse(body);
    const message = extractMessage(payload);
    if (!message.messageId || !message.remoteJid) {
      console.warn(JSON.stringify({ ts: new Date().toISOString(), fn: FN, reqId, nivel: "warn", msg: "payload sem mensagem reconhecível" }));
      return json(200, { ok: true, ignored: true }, cors);
    }

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!url || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const now = new Date().toISOString();
    const instanceId = message.instanceId ?? "default";
    const queueKey = `${instanceId}:${message.remoteJid}`;

    const { error: insertMessageError } = await db.schema("atendimento").from("wa_messages").upsert(
      {
        instance_id: instanceId,
        remote_jid: message.remoteJid,
        sender_jid: message.senderJid,
        message_id: message.messageId,
        content: message.content,
        received_at: message.receivedAt ?? now,
        created_at: now,
      },
      { onConflict: "message_id" },
    );
    if (insertMessageError) throw insertMessageError;

    // E02-S01: aggregate voltado a humano (Inbox) — existe/atualiza mesmo com config_ze
    // desligada/ausente, senão a conversa nunca apareceria pro humano ver.
    await registrarConversaEMensagem(db, instanceId, message);

    const waitUntil = new Date(Date.now() + 3000).toISOString();
    const { data: pending, error: pendingError } = await db
      .schema("atendimento")
      .from("wa_queue")
      .select("id")
      .eq("queue_key", queueKey)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pendingError) throw pendingError;

    if (pending?.id) {
      const { error } = await db
        .schema("atendimento")
        .from("wa_queue")
        .update({ wait_until: waitUntil, error_message: null })
        .eq("id", pending.id);
      if (error) throw error;
    } else {
      const { error } = await db.schema("atendimento").from("wa_queue").insert({
        queue_key: queueKey,
        wait_until: waitUntil,
        status: "pending",
      });
      if (error) throw error;
    }

    scheduleAgent(url, serviceKey, queueKey);
    return json(200, { ok: true, queued: true, queueKey }, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof z.ZodError) return problem(422, "Input inválido", reqId, cors);
    console.error(JSON.stringify({ ts: new Date().toISOString(), fn: FN, reqId, nivel: "error", msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors);
  }
});

async function validateEvolutionSignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get("EVOLUTION_HMAC_SECRET") ?? "";
  if (!secret) return false;
  const header =
    req.headers.get("X-Evolution-Signature") ??
    req.headers.get("X-Hub-Signature-256") ??
    req.headers.get("x-signature");
  if (!header) return false;
  const received = header.startsWith("sha256=") ? header.slice("sha256=".length) : header;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return constantTimeEqual(expected, received);
}

function extractMessage(payload: Record<string, unknown>): {
  instanceId: string | null;
  remoteJid: string | null;
  senderJid: string | null;
  messageId: string | null;
  content: string | null;
  receivedAt: string | null;
  contactName: string | null;
} {
  const data = asObject(payload.data) ?? asObject(payload.message) ?? payload;
  const key = asObject(data.key);
  const message = asObject(data.message);
  const content =
    firstString([
      data.conversation,
      data.text,
      data.body,
      data.messageText,
      message?.conversation,
      asObject(message?.extendedTextMessage)?.text,
      asObject(message?.buttonsResponseMessage)?.selectedDisplayText,
      asObject(message?.buttonsResponseMessage)?.selectedButtonId,
      asObject(message?.listResponseMessage)?.title,
      asObject(asObject(message?.listResponseMessage)?.singleSelectReply)?.selectedRowId,
    ]) ??
    "";
  return {
    instanceId: firstString([payload.instance, payload.instanceId, data.instanceId]),
    remoteJid: firstString([data.remoteJid, key?.remoteJid]),
    senderJid: firstString([data.sender, data.senderJid, key?.participant]),
    messageId: firstString([data.messageId, data.id, key?.id]),
    content,
    receivedAt: toIso(data.messageTimestamp ?? data.timestamp ?? payload.date_time),
    // E02-S01: nome de exibição do contato/grupo — só usado como cache pra lista do Inbox
    // (nunca bloqueia o fluxo se ausente). Shape de entrega não confirmado, extração defensiva.
    contactName: firstString([data.pushName, payload.pushName, data.notifyName]),
  };
}

/** E02-S01: grava/atualiza atendimento.conversas e insere a mensagem de entrada via RPC atômica
 * (idempotente por wa_message_id, incrementa nao_lidas sem race condition). Roda mesmo com
 * config_ze desligada/ausente — senão a conversa nunca apareceria pro Inbox humano ver. */
async function registrarConversaEMensagem(
  db: UntypedSupabaseClient,
  instanceId: string,
  message: ReturnType<typeof extractMessage>,
): Promise<void> {
  const { error } = await db.schema("atendimento").rpc("fn_registrar_mensagem_entrada", {
    p_instance_id: instanceId,
    p_remote_jid: message.remoteJid,
    p_contato_nome: message.contactName,
    p_conteudo: message.content,
    p_wa_message_id: message.messageId,
  });
  if (error) throw error;
}

function scheduleAgent(url: string, serviceKey: string, queueKey: string): void {
  const run = async () => {
    await new Promise((resolve) => setTimeout(resolve, 3100));
    await fetch(`${url}/functions/v1/pcm-ze-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ queueKey }),
    }).catch(() => undefined);
  };
  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  edgeRuntime?.waitUntil ? edgeRuntime.waitUntil(run()) : run();
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function toIso(value: unknown): string | null {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  if (typeof value === "number") {
    const ms = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}

function problem(status: number, detail: string, reqId: string, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ type: "about:blank", status, detail, reqId }), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
