import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";
import { auvoGet, buildParamFilter } from "../_shared/auvo/client.ts";
import { auvoPaginate, DEFAULT_PAGE_SIZE } from "../_shared/auvo/paginate.ts";

// E03-S11: "satisfactions" saiu do union type — decisão do PO, a Sinérgica não usa a pesquisa de
// satisfação do Auvo (pcm.satisfacao_respostas vira espelho inativo, migration 0201). O request
// handler abaixo ainda reconhece o valor pra devolver um erro claro de "desativado", distinto de
// um `resource` desconhecido/inválido.
type Resource = "questionnaires" | "expenses";
type ApiList = { result?: { entityList?: Record<string, unknown>[] } | Record<string, unknown>[] };
const list = (response: ApiList) => Array.isArray(response.result) ? response.result : response.result?.entityList ?? [];
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

async function pull(resource: Resource, db: UntypedSupabaseClient) {
  if (resource === "questionnaires") {
    const rows = await auvoPaginate<Record<string, unknown>>((page, pageSize) => auvoGet<ApiList>(`/questionnaires?page=${page}&pageSize=${pageSize}&order=asc`).then(list), { pageSize: DEFAULT_PAGE_SIZE });
    const mapped = rows.map((row) => ({ auvo_id: number(row.id), nome: text(row.description) ?? `Questionário ${row.id}`, cabecalho: text(row.header), rodape: text(row.footer), perguntas: Array.isArray(row.questions) ? row.questions : [], ativo: row.active !== false, auvo_payload: row })).filter((row) => row.auvo_id != null);
    if (mapped.length) { const { error } = await db.schema("pcm").from("questionarios").upsert(mapped, { onConflict: "auvo_id" }); if (error) throw error; }
    return { resource, pulled: rows.length, upserted: mapped.length };
  }
  if (resource === "expenses") {
    const today = new Date(); const start = new Date(today.getTime() - 31 * 86_400_000).toISOString().slice(0, 10); const end = today.toISOString().slice(0, 10);
    const types = await auvoPaginate<Record<string, unknown>>((page, pageSize) => auvoGet<ApiList>(`/expensetypes?page=${page}&pageSize=${pageSize}&order=asc`).then(list), { pageSize: DEFAULT_PAGE_SIZE });
    const typeRows = types.map((row) => ({ auvo_id: number(row.id), nome: text(row.description) ?? `Tipo ${row.id}`, auvo_payload: row })).filter((row) => row.auvo_id != null);
    if (typeRows.length) { const { error } = await db.schema("pcm").from("despesa_tipos").upsert(typeRows, { onConflict: "auvo_id" }); if (error) throw error; }
    const expenses = await auvoPaginate<Record<string, unknown>>((page, pageSize) => auvoGet<ApiList>(`/expenses?${buildParamFilter({ startDate: start, endDate: end })}&page=${page}&pageSize=${pageSize}&order=desc`).then(list), { pageSize: DEFAULT_PAGE_SIZE });
    const expenseRows = expenses.map((row) => ({ auvo_id: number(row.id), despesa_tipo_auvo_id: number(row.typeId), funcionario_auvo_id: number(row.userToId), auvo_task_id: number(row.taskId), data: text(row.date), valor_centavos: number(row.amount) == null ? null : Math.round(Number(row.amount) * 100), descricao: text(row.description), auvo_payload: row })).filter((row) => row.auvo_id != null);
    if (expenseRows.length) { const { error } = await db.schema("pcm").from("despesas").upsert(expenseRows, { onConflict: "auvo_id" }); if (error) throw error; }
    return { resource, types: typeRows.length, pulled: expenses.length, upserted: expenseRows.length };
  }
  // Inalcançável em uso normal — `Resource` só tem 2 valores e os dois `if` acima já retornam.
  // Fica como guarda de tipo (TS não estreita `resource` pra `never` sozinho aqui).
  const _exhaustive: never = resource;
  throw new HttpError(500, `recurso não implementado: ${String(_exhaustive)}`);
}

if (import.meta.main) serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin")); if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors }); const reqId = crypto.randomUUID().slice(0, 8);
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    requireServiceRole(req);
    const raw = ((await req.json().catch(() => ({}))) as { resource?: string }).resource;
    // E03-S11: "satisfactions" é reconhecido à parte pra devolver erro claro de recurso
    // desativado (AC-1) — distinto de um valor desconhecido/inválido (typo, garbage input).
    if (raw === "satisfactions") {
      throw new HttpError(
        400,
        "resource desativado — a pesquisa de satisfação do Auvo não é usada (migration 0201, E03-S11); fonte canônica de CSAT/NPS é pcm.portal_satisfacao",
      );
    }
    if (!raw || !["questionnaires", "expenses"].includes(raw)) throw new HttpError(400, "resource inválido");
    const resource = raw as Resource;
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new HttpError(500, "Ambiente Supabase incompleto");
    const result = await pull(resource, createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
    return new Response(JSON.stringify({ ok: true, ...result }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 502;
    const detail = error instanceof HttpError ? error.message : "Não foi possível sincronizar o recurso Auvo";
    console.error(JSON.stringify({ fn: "pcm-auvo-support-pull", reqId, detail: String(error) }));
    return new Response(JSON.stringify({ type: "about:blank", title: "Erro", status, detail, reqId }), { status, headers: { "Content-Type": "application/problem+json", ...cors } });
  }
});

export { pull as pullSupportResource };
