// pcm-whatsapp-webhook — entrada Evolution API/WhatsApp para o Agente Zé (E01-S02).
// Valida HMAC, persiste atendimento.wa_messages e enfileira atendimento.wa_queue com delay de 3s.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError } from "../_shared/auth.ts";
import { constantTimeEqual } from "../_shared/crypto.ts";
import {
  extractEvolutionMessage,
  normalizarEventoEvolution,
  type EvolutionIncomingMessage,
} from "../_shared/evolution-webhook.ts";

const FN = "pcm-whatsapp-webhook";

const EvolutionWebhookSchema = z
  .object({
    event: z.string().optional(),
    instance: z.string().optional(),
    instanceId: z.string().optional(),
    data: z.record(z.unknown()).optional(),
  })
  .passthrough();

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });
  const reqId = crypto.randomUUID().slice(0, 8);

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");

    const rawBody = await req.text();
    if (!(await validateEvolutionAuth(req, rawBody))) {
      throw new HttpError(401, "Assinatura inválida");
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new HttpError(400, "JSON inválido");
    }
    const payload = EvolutionWebhookSchema.parse(body);
    const event = normalizarEventoEvolution(payload.event);
    if (event && event !== "messages.upsert") {
      return json(200, { ok: true, ignored: true, reason: "event" }, cors);
    }
    const message = extractEvolutionMessage(payload);
    if (message.fromMe) {
      return json(200, { ok: true, ignored: true, reason: "fromMe" }, cors);
    }
    if (message.remoteJid?.endsWith("@broadcast")) {
      return json(200, { ok: true, ignored: true, reason: "broadcast" }, cors);
    }
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
    const { data: rateAllowed, error: rateError } = await db
      .schema("atendimento")
      .rpc("fn_consumir_rate_limit_webhook", {
        p_chave: `evolution:${instanceId}`,
        p_limite: 120,
        p_janela_segundos: 60,
      });
    if (rateError) throw rateError;
    if (!rateAllowed) throw new HttpError(429, "Limite de webhook excedido");
    const queueKey = `${instanceId}:${message.remoteJid}`;

    const { data: insertedMessage, error: insertMessageError } = await db
      .schema("atendimento")
      .from("wa_messages")
      .upsert(
      {
        instance_id: instanceId,
        remote_jid: message.remoteJid,
        sender_jid: message.senderJid,
        message_id: message.messageId,
        content: message.content,
        received_at: message.receivedAt ?? now,
        created_at: now,
      },
      { onConflict: "message_id", ignoreDuplicates: true },
    )
      .select("id")
      .maybeSingle();
    if (insertMessageError) throw insertMessageError;
    if (!insertedMessage) {
      return json(200, { ok: true, ignored: true, reason: "duplicate" }, cors);
    }

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

async function validateEvolutionAuth(req: Request, rawBody: string): Promise<boolean> {
  const hmacSecret = Deno.env.get("EVOLUTION_HMAC_SECRET") ?? "";
  const webhookToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") ?? hmacSecret;
  const receivedToken = req.headers.get("X-Sinergica-Webhook-Token") ?? "";
  if (webhookToken && receivedToken && constantTimeEqual(webhookToken, receivedToken)) return true;

  const header =
    req.headers.get("X-Evolution-Signature") ??
    req.headers.get("X-Hub-Signature-256") ??
    req.headers.get("x-signature");
  if (!hmacSecret || !header) return false;
  const received = header.startsWith("sha256=") ? header.slice("sha256=".length) : header;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(hmacSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return constantTimeEqual(expected, received);
}

/** E02-S01: grava/atualiza atendimento.conversas e insere a mensagem de entrada via RPC atômica
 * (idempotente por wa_message_id, incrementa nao_lidas sem race condition). Roda mesmo com
 * config_ze desligada/ausente — senão a conversa nunca apareceria pro Inbox humano ver. */
async function registrarConversaEMensagem(
  db: UntypedSupabaseClient,
  instanceId: string,
  message: EvolutionIncomingMessage,
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

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}

function problem(status: number, detail: string, reqId: string, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ type: "about:blank", status, detail, reqId }), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
