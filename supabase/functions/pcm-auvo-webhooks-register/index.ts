// pcm-auvo-webhooks-register — one-shot pós-deploy para registrar webhooks Auvo (E01-S23).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { AuvoApiError, auvoGet, auvoPost } from "../_shared/auvo/client.ts";
import { getDescriptor, listEntities } from "../_shared/auvo/registry/index.ts";

const FN = "pcm-auvo-webhooks-register";

interface ExistingWebhook {
  id?: number;
  entity?: number;
  targetUrl?: string;
  url?: string;
}

interface ExistingWebhooksResponse {
  result?: ExistingWebhook[] | {
    entityList?: ExistingWebhook[];
  };
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, method: req.method }));

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    requireServiceRole(req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!supabaseUrl || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");
    const targetUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/pcm-auvo-webhook`;

    const descriptors = listEntities()
      .map((entity) => getDescriptor(entity))
      .filter((descriptor) => descriptor?.webhookEntity != null);

    const existing = await loadExistingWebhooks();
    const registered: string[] = [];
    const skipped: string[] = [];

    for (const descriptor of descriptors) {
      if (!descriptor?.webhookEntity) continue;
      const alreadyExists = existing.some((webhook) =>
        webhook.entity === descriptor.webhookEntity && normalizeUrl(webhook.targetUrl ?? webhook.url) === normalizeUrl(targetUrl)
      );
      if (alreadyExists) {
        skipped.push(descriptor.key);
        continue;
      }

      try {
        await auvoPost("/webhooks", {
          entity: descriptor.webhookEntity,
          targetUrl,
        });
        registered.push(descriptor.key);
      } catch (e) {
        if (e instanceof AuvoApiError && e.status === 400 && /already|registrad|existe/i.test(e.message)) {
          skipped.push(descriptor.key);
          continue;
        }
        throw e;
      }
    }

    const result = { ok: true, registered, skipped };
    console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, msg: "registro de webhooks concluído", ...result }));
    return json(200, result, cors);
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

async function loadExistingWebhooks(): Promise<ExistingWebhook[]> {
  try {
    const response = await auvoGet<ExistingWebhooksResponse>("/webhooks");
    if (Array.isArray(response.result)) return response.result;
    if (Array.isArray(response.result?.entityList)) return response.result.entityList;
    return [];
  } catch (e) {
    if (e instanceof AuvoApiError && e.status === 404) return [];
    throw e;
  }
}

function normalizeUrl(url: string | undefined): string {
  return (url ?? "").trim().replace(/\/$/, "");
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
