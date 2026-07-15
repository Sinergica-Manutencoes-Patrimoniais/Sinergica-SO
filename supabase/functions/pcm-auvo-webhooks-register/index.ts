// pcm-auvo-webhooks-register — one-shot pós-deploy para registrar webhooks Auvo (E01-S23).
//
// E01-S68: ganhou o passo de DELETAR webhooks stale (URL divergente da atual) antes de registrar.
// Achado em produção 2026-07-14: os 6 webhooks (Customer/Task/Equipment × Inclusão/Alteração)
// apontavam pro projeto Supabase ANTIGO (sobrevivente de antes do reprovisionamento) — o caminho
// de tempo real estava morto, ninguém tinha notado porque o cron de tasks-import mascarava o
// sintoma. Também corrigido: o contrato real de `GET /webHooks` NÃO bate com o que o código
// assumia — confirmado contra a API real:
//   - o campo da URL é `urlResponse`, não `targetUrl`/`url`;
//   - `entity` vem como STRING (ex.: "Customer", "Task"), não o código numérico do nosso registry
//     (`webhookEntity: 7` pra clientes aparece como `"Customer"` na resposta) — pra entidades sem
//     nome amigável no Auvo, vem o próprio número como string (ex.: `"27"` pra equipamentos).
// Isso explica por que a checagem de idempotência antiga nunca funcionava de verdade (comparava
// campos que não existiam) — o registro dependia só do catch de "already registered" do Auvo.
//
// `Task` não faz parte do registry genérico de entidades (webhookEntity numérico) — é tratado à
// parte desde E01-S9/S10 (código dedicado em os-from-task.ts/pcm-auvo-webhook), então não tem
// `AuvoEntityDescriptor` pra iterar. O código de entidade É conhecido, porém: `registry/types.ts`
// já documenta "1-User, 4-Task, 7-Customer, 27-Equipment, 50-Invoice, 62-Ticket" — por isso o
// Task webhook (`TASK_WEBHOOK_ENTITY = 4`) é registrado explicitamente aqui, fora do loop de
// descriptors, sem inventar valor novo.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { AuvoApiError, auvoDelete, auvoGet, auvoPost } from "../_shared/auvo/client.ts";
import { getDescriptor, listEntities } from "../_shared/auvo/registry/index.ts";
import type { AuvoEntityDescriptor } from "../_shared/auvo/registry/types.ts";

const FN = "pcm-auvo-webhooks-register";

/** Código de entidade "Task" no Auvo — documentado em `registry/types.ts` (comentário de
 * `webhookEntity`), confirmado como o mesmo catálogo que a API usa pra `POST /webhooks`. Task não
 * tem `AuvoEntityDescriptor` (é tratado à parte, ver comentário no topo do arquivo), por isso o
 * valor fica hardcoded aqui em vez de vir do registry genérico. */
const TASK_WEBHOOK_ENTITY = 4;
const TASK_DESCRIPTOR_KEY = "task";

export interface ExistingWebhook {
  id?: number;
  entity?: string;
  action?: string;
  urlResponse?: string;
  active?: boolean;
}

interface ExistingWebhooksResponse {
  result?: ExistingWebhook[] | {
    entityList?: ExistingWebhook[];
  };
}

export function normalizeUrl(url: string | undefined): string {
  return (url ?? "").trim().replace(/\/$/, "");
}

/** Função pura: quais webhooks existentes têm URL diferente da atual — precisam ser deletados
 * antes de qualquer registro novo (E01-S68). Ignora entradas sem `id` (nada a deletar). */
export function encontrarWebhooksStale(
  existentes: ExistingWebhook[],
  targetUrl: string,
): ExistingWebhook[] {
  return existentes.filter(
    (webhook) => webhook.id != null && normalizeUrl(webhook.urlResponse) !== normalizeUrl(targetUrl),
  );
}

/** Função pura: dado o estado (pós-delete) e os descriptors com `webhookEntity`, quais ainda
 * precisam de `POST /webhooks` — casa por código numérico OU pela key do descriptor (Auvo às
 * vezes devolve o nome amigável, ex. "Customer", às vezes o número como string). */
export function descriptorsParaRegistrar(
  descriptors: Array<AuvoEntityDescriptor<unknown, unknown> | undefined>,
  existentesAtualizados: ExistingWebhook[],
  targetUrl: string,
): Array<AuvoEntityDescriptor<unknown, unknown>> {
  return descriptors.filter((descriptor): descriptor is AuvoEntityDescriptor<unknown, unknown> => {
    if (!descriptor?.webhookEntity) return false;
    const codigo = String(descriptor.webhookEntity);
    const jaExisteComUrlCerta = existentesAtualizados.some((webhook) =>
      (webhook.entity === codigo || webhook.entity === descriptor.key) &&
      normalizeUrl(webhook.urlResponse) === normalizeUrl(targetUrl)
    );
    return !jaExisteComUrlCerta;
  });
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });

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

    const existing = await loadExistingWebhooks();

    // 1) Deleta qualquer webhook cuja URL não seja a atual — stale, independente de qual entidade
    // for (é o problema real que causou o incidente: nenhum apontava pro projeto certo).
    const stale = encontrarWebhooksStale(existing, targetUrl);
    const deleted: Array<{ id: number; entity?: string; action?: string }> = [];
    const deleteFailures: Array<{ id: number; error: string }> = [];
    for (const webhook of stale) {
      try {
        await auvoDelete(`/webHooks/${webhook.id}`);
        deleted.push({ id: webhook.id as number, entity: webhook.entity, action: webhook.action });
      } catch (e) {
        deleteFailures.push({ id: webhook.id as number, error: e instanceof Error ? e.message : String(e) });
        console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "falha ao deletar webhook stale", id: webhook.id, entity: webhook.entity }));
      }
    }

    // 2) Registra os descriptors do registry genérico + Task explícito (entity=4, fora do
    // registry — ver comentário no topo). Reconsulta o estado atual (pós-delete) pra não duplicar
    // o que sobrou íntegro.
    const aindaExistentes = deleted.length > 0 ? await loadExistingWebhooks() : existing;
    const descriptors = listEntities().map((entity) => getDescriptor(entity));
    const paraRegistrar: Array<{ key: string; webhookEntity: number }> = [
      ...descriptorsParaRegistrar(descriptors, aindaExistentes, targetUrl).map((d) => ({
        key: d.key,
        webhookEntity: d.webhookEntity as number,
      })),
    ];
    const taskJaTemUrlCerta = aindaExistentes.some((webhook) =>
      (webhook.entity === String(TASK_WEBHOOK_ENTITY) || webhook.entity === "Task") &&
      normalizeUrl(webhook.urlResponse) === normalizeUrl(targetUrl)
    );
    if (!taskJaTemUrlCerta) {
      paraRegistrar.push({ key: TASK_DESCRIPTOR_KEY, webhookEntity: TASK_WEBHOOK_ENTITY });
    }
    const jaTinhamUrlCerta = [
      ...descriptors
        .filter((d): d is AuvoEntityDescriptor<unknown, unknown> => d?.webhookEntity != null)
        .filter((d) => !paraRegistrar.some((p) => p.key === d.key))
        .map((d) => d.key),
      ...(taskJaTemUrlCerta ? [TASK_DESCRIPTOR_KEY] : []),
    ];

    const registered: string[] = [];
    const skipped: string[] = [...jaTinhamUrlCerta];

    for (const item of paraRegistrar) {
      try {
        await auvoPost("/webhooks", {
          entity: item.webhookEntity,
          targetUrl,
        });
        registered.push(item.key);
      } catch (e) {
        if (e instanceof AuvoApiError && e.status === 400 && /already|registrad|existe/i.test(e.message)) {
          skipped.push(item.key);
          continue;
        }
        throw e;
      }
    }

    const result = { ok: deleteFailures.length === 0, deleted, deleteFailures, registered, skipped };
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
