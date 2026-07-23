import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";
import { auvoGet, buildParamFilter } from "../_shared/auvo/client.ts";
import { auvoPaginate, DEFAULT_PAGE_SIZE } from "../_shared/auvo/paginate.ts";

type Resource = "questionnaires" | "expenses" | "satisfactions";
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
  // 1 GET por OS finalizada (o endpoint só filtra por taskId). Limite + orçamento de tempo evitam
  // estourar o teto de ~150s do worker quando o Auvo estiver lento (mesma lição do sync-all/E01-S37).
  const { data: orders, error: ordersError } = await db.schema("pcm").from("ordens_servico").select("auvo_task_id").eq("status", "finalizado").not("auvo_task_id", "is", null).order("updated_at", { ascending: false }).limit(20);
  if (ordersError) throw ordersError;
  let pulled = 0; let upserted = 0; let interrompidoEmMs: number | null = null;
  const inicio = Date.now();
  for (const order of orders ?? []) {
    if (Date.now() - inicio > 45_000) { interrompidoEmMs = Date.now() - inicio; break; }
    const taskId = number(order.auvo_task_id); if (taskId == null) continue;
    const rows = await auvoGet<ApiList>(`/satisfactionsurveys?${buildParamFilter({ taskId })}&page=1&pageSize=100`).then(list);
    pulled += rows.length;
    const mapped = rows.map((row) => ({ auvo_id: number(row.id), auvo_task_id: number(row.taskId), pergunta: text(row.questionDescription), resposta: text(row.answerDescription), respondida_em: text(row.answerDate), score: number(row.scoreSum) == null ? null : Math.round(Number(row.scoreSum) / Math.max(1, number(row.totalResponse) ?? 1)), email: text(row.email), auvo_payload: row })).filter((row) => row.auvo_id != null && row.auvo_task_id != null);
    if (mapped.length) { const { error } = await db.schema("pcm").from("satisfacao_respostas").upsert(mapped, { onConflict: "auvo_id" }); if (error) throw error; upserted += mapped.length; }
  }
  return { resource, pulled, upserted, ...(interrompidoEmMs == null ? {} : { truncadoPorTempoMs: interrompidoEmMs }) };
}

if (import.meta.main) serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin")); if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors }); const reqId = crypto.randomUUID().slice(0, 8);
  try { if (req.method !== "POST") throw new HttpError(405, "Método não permitido"); requireServiceRole(req); const resource = ((await req.json().catch(() => ({}))) as { resource?: Resource }).resource; if (!resource || !["questionnaires", "expenses", "satisfactions"].includes(resource)) throw new HttpError(400, "resource inválido"); const url = Deno.env.get("SUPABASE_URL") ?? ""; const key = getSupabaseServiceKey(); if (!url || !key) throw new HttpError(500, "Ambiente Supabase incompleto"); const result = await pull(resource, createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })); return new Response(JSON.stringify({ ok: true, ...result }), { status: 200, headers: { "Content-Type": "application/json", ...cors } }); }
  catch (error) { const status = error instanceof HttpError ? error.status : 502; console.error(JSON.stringify({ fn: "pcm-auvo-support-pull", reqId, detail: String(error) })); return new Response(JSON.stringify({ type: "about:blank", title: "Erro", status, detail: "Não foi possível sincronizar o recurso Auvo", reqId }), { status, headers: { "Content-Type": "application/problem+json", ...cors } }); }
});

export { pull as pullSupportResource };
