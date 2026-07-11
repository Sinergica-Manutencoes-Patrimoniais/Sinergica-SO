import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { AuvoApiError, auvoGet, buildParamFilter } from "../_shared/auvo/client.ts";
import { auvoPaginate, DEFAULT_PAGE_SIZE } from "../_shared/auvo/paginate.ts";

interface DeletedTask { taskID?: number; id?: number; taskId?: number }
interface DeletedTasksResponse { result?: { entityList?: DeletedTask[] } | DeletedTask[] }
interface RequestBody { startDate?: string; endDate?: string }

export function extractDeletedTaskIds(tasks: DeletedTask[]): number[] {
  return [...new Set(tasks.map((task) => task.taskID ?? task.id ?? task.taskId).filter((id): id is number => typeof id === "number" && Number.isFinite(id)))];
}

async function run(body: RequestBody, db: ReturnType<typeof createClient>) {
  const now = new Date();
  const start = body.startDate ?? new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
  const end = body.endDate ?? now.toISOString().slice(0, 10);
  const filter = buildParamFilter({ startDate: start, endDate: end });
  const tasks = await auvoPaginate<DeletedTask>(
    (page, pageSize) => auvoGet<DeletedTasksResponse>(`/tasks/GetDeletedTasks?${filter}&page=${page}&pageSize=${pageSize}&order=asc`).then((response) => Array.isArray(response.result) ? response.result : response.result?.entityList ?? []),
    { pageSize: DEFAULT_PAGE_SIZE },
  );
  const taskIds = extractDeletedTaskIds(tasks);
  const { data, error } = await db.schema("pcm").rpc("fn_cancelar_os_tarefas_auvo_excluidas", { p_auvo_task_ids: taskIds });
  if (error) throw error;
  return { pulled: tasks.length, taskIds: taskIds.length, ...(Array.isArray(data) ? data[0] : data ?? {}) };
}

if (import.meta.main) serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const reqId = crypto.randomUUID().slice(0, 8);
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    requireServiceRole(req);
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new HttpError(500, "Ambiente Supabase incompleto");
    const result = await run(await req.json().catch(() => ({})), createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
    return new Response(JSON.stringify({ ok: true, ...result }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error instanceof AuvoApiError ? 502 : 500;
    console.error(JSON.stringify({ fn: "pcm-auvo-deleted-tasks-sync", reqId, status, detail: String(error) }));
    return new Response(JSON.stringify({ type: "about:blank", title: "Erro", status, detail: status === 502 ? "Auvo indisponível" : "Não foi possível reconciliar tarefas excluídas", reqId }), { status, headers: { "Content-Type": "application/problem+json", ...cors } });
  }
});

export { run as runDeletedTasksSync };
