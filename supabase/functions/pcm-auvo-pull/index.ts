// pcm-auvo-pull — poller genérico Auvo→PCM (E01-S23).
// Recebe `{ entity }`, resolve o descriptor no registry, pagina o endpoint Auvo inteiro, aplica
// `descriptor.fromAuvo` por registro e reconcilia soft-delete local para registros que sumiram.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { AuvoApiError, auvoGet } from "../_shared/auvo/client.ts";
import { auvoPaginate, DEFAULT_PAGE_SIZE } from "../_shared/auvo/paginate.ts";
import { getDescriptor } from "../_shared/auvo/registry/index.ts";
import type { AuvoEntityDescriptor } from "../_shared/auvo/registry/types.ts";
import { extractAuvoId } from "../_shared/auvo/webhook-dispatch.ts";

const FN = "pcm-auvo-pull";

interface PullRequestBody {
  entity?: string;
}

interface AuvoListResponse<T> {
  result?: T[] | {
    entityList?: T[];
    items?: T[];
  };
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  let healthDb: UntypedSupabaseClient | null = null;
  let healthEntity: string | null = null;
  console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, method: req.method }));

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    requireServiceRole(req);

    const body = (await req.json().catch(() => ({}))) as PullRequestBody;
    if (!body.entity) throw new HttpError(400, "Campo entity obrigatório");

    const descriptor = getDescriptor(body.entity) as
      | AuvoEntityDescriptor<Record<string, unknown>, Record<string, unknown>>
      | undefined;
    if (!descriptor) {
      return json(200, { ok: true, ignored: true, reason: "descriptor_not_found", entity: body.entity }, cors);
    }
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!url || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    healthDb = db;
    healthEntity = descriptor.key;

    const records = await auvoPaginate<Record<string, unknown>>(
      (pageNumber, pageSize) =>
        auvoGet<AuvoListResponse<Record<string, unknown>>>(
          `${descriptor.auvoBasePath}?page=${pageNumber}&pageSize=${pageSize}&order=asc`,
        ).then(extractEntityList),
      { pageSize: DEFAULT_PAGE_SIZE },
    );

    const syncedIds: string[] = [];
    let upserted = 0;
    for (const record of records) {
      const auvoId = extractAuvoId({ payload: record });
      if (auvoId == null) {
        console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "registro Auvo sem id — ignorado", entity: descriptor.key, record }));
        continue;
      }

      const patch: Record<string, unknown> = {
        ...descriptor.fromAuvo(record),
        auvo_id: auvoId,
        auvo_sync_status: "synced",
        auvo_sync_error: null,
        auvo_synced_at: new Date().toISOString(),
      };
      const employeesStock = patch.employees_stock;
      delete patch.employees_stock;

      const { error } = await db.schema("pcm").rpc("fn_upsert_auvo_sync", {
        p_table: descriptor.pcmTable,
        p_auvo_id: String(auvoId),
        p_patch: patch,
      });
      if (error) throw error;
      if (descriptor.key === "ferramentas" && Array.isArray(employeesStock)) {
        const { data: ferramenta, error: ferramentaError } = await db
          .schema("pcm")
          .from(descriptor.pcmTable)
          .select("id")
          .eq("auvo_id", auvoId)
          .maybeSingle();
        if (ferramentaError) throw ferramentaError;
        if (ferramenta?.id) {
          const { error: reconcileError } = await db.schema("pcm").rpc("fn_reconcile_ferramenta_alocacoes", {
            p_ferramenta_id: ferramenta.id,
            p_employees_stock: employeesStock,
          });
          if (reconcileError) throw reconcileError;
        }
      }
      syncedIds.push(String(auvoId));
      upserted++;
    }

    let softDeleted = 0;
    if (syncedIds.length > 0) {
      const { data, error } = await db.schema("pcm").rpc("fn_soft_delete_missing_auvo_sync", {
        p_table: descriptor.pcmTable,
        p_auvo_ids: syncedIds,
      });
      if (error) throw error;
      softDeleted = Number(data ?? 0);
    } else {
      console.error(JSON.stringify({ ts: now, nivel: "warn", fn: FN, reqId, msg: "pull Auvo retornou 0 registros — reconciliação de soft-delete pulada", entity: descriptor.key }));
    }

    const result = { ok: true, entity: descriptor.key, pulled: records.length, upserted, softDeleted };
    await registrarSaudePull(db, descriptor.key, {
      last_pull_ok_at: new Date().toISOString(),
      last_error_at: null,
      last_error: null,
    });
    console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, msg: "pull concluído", ...result }));
    return json(200, result, cors);
  } catch (e) {
    if (healthDb && healthEntity) {
      await registrarSaudePull(healthDb, healthEntity, {
        last_error_at: new Date().toISOString(),
        last_error: (e instanceof Error ? e.message : String(e)).slice(0, 2000),
      });
    }
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof AuvoApiError) {
      console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "falha Auvo", status: e.status, requestId: e.requestId }));
      return problem(502, `Auvo indisponível ou erro: ${e.message}`, reqId, cors);
    }
    console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors);
  }
});

async function registrarSaudePull(
  db: UntypedSupabaseClient,
  entity: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const descriptor = getDescriptor(entity);
  const { error } = await db
    .schema("pcm")
    .from("auvo_entity_status")
    .upsert(
      { entity, write_enabled: descriptor?.writeEnabled ?? false, updated_at: new Date().toISOString(), ...patch },
      { onConflict: "entity" },
    );
  if (error) console.error(JSON.stringify({ nivel: "error", fn: FN, msg: "falha ao registrar saúde do pull", entity }));
}

function extractEntityList<T>(response: AuvoListResponse<T>): T[] {
  if (Array.isArray(response.result)) return response.result;
  if (Array.isArray(response.result?.entityList)) return response.result.entityList;
  if (Array.isArray(response.result?.items)) return response.result.items;
  return [];
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
    502: "Bad Gateway",
  };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
