// Validação operacional explícita do contrato Auvo. Cria UMA task de teste e só libera
// preventivas se a leitura posterior confirmar técnico, data, alvo e questionário.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireAuth } from "../_shared/auth.ts";
import { auvoGet, auvoPatch, auvoPost, buildParamFilter } from "../_shared/auvo/client.ts";
import { toAuvoJsonPatch } from "../_shared/auvo/json-patch.ts";

const Input = z.object({ clienteId: z.string().uuid(), tecnicoFuncionarioId: z.string().uuid(), questionarioId: z.string().uuid(), tipoTarefaId: z.string().uuid(), equipamentoAuvoId: z.number().int().positive(), alvoTipo: z.enum(["sistema", "equipamento"]), visitaEm: z.string().datetime() });
function claims(req: Request): Record<string, unknown> { try { const p = (req.headers.get("Authorization")?.replace("Bearer ", "") ?? "").split(".")[1]; return JSON.parse(atob((p ?? "").replace(/-/g, "+").replace(/_/g, "/"))); } catch { return {}; } }
/** Auvo v2 pode devolver o identificador diretamente em `result` ou em um objeto. */
export function taskId(valor: unknown): number | null {
  const x = valor as {
    result?: number | { id?: number; taskID?: number; taskId?: number };
    id?: number;
    taskID?: number;
    taskId?: number;
  };
  if (typeof x.result === "number") return x.result;
  return x.result?.id ?? x.result?.taskID ?? x.result?.taskId ?? x.id ?? x.taskID ?? x.taskId ?? null;
}

type AuvoTaskTeste = {
  taskID?: number;
  id?: number;
  taskId?: number;
  externalId?: string;
  customerId?: number;
  equipmentId?: number;
  taskTypeId?: number;
  orientation?: string;
};

type AuvoTasksResposta = { result?: AuvoTaskTeste[] | { entityList?: AuvoTaskTeste[] } };

function tarefasDaResposta(resposta: AuvoTasksResposta): AuvoTaskTeste[] {
  if (Array.isArray(resposta.result)) return resposta.result;
  return resposta.result?.entityList ?? [];
}

export function taskTesteExistente(
  resposta: AuvoTasksResposta,
  alvo: { externalId: string; customerId: number; equipmentId: number; taskTypeId: number },
): number | null {
  const tarefas = tarefasDaResposta(resposta);
  const exata = tarefas.find((tarefa) => tarefa.externalId === alvo.externalId);
  const legada = tarefas.filter((tarefa) =>
    tarefa.orientation === "TESTE DE CONTRATO PCM PREVENTIVAS — não executar" &&
    tarefa.customerId === alvo.customerId &&
    tarefa.equipmentId === alvo.equipmentId &&
    tarefa.taskTypeId === alvo.taskTypeId,
  ).at(-1);
  return taskId(exata ?? legada ?? {});
}

type EvidenciaAlvo = { tecnico?: boolean; data?: boolean; alvo?: boolean; questionario?: boolean };
export function contratoPreventivoCompleto(evidencia: Record<string, unknown>): boolean {
  return ["sistema", "equipamento"].every((tipo) => {
    const item = evidencia[tipo] as EvidenciaAlvo | undefined;
    return item?.tecnico === true && item.data === true && item.alvo === true && item.questionario === true;
  });
}

if (import.meta.main) serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    await requireAuth(req);
    const c = claims(req);
    if (c.user_role !== "superadmin") throw new HttpError(403, "Somente superadmin pode validar o contrato Auvo");
    const input = Input.parse(await req.json());
    if (new Date(input.visitaEm).getTime() <= Date.now()) throw new HttpError(422, "Use uma data futura para a task de teste");
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", getSupabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: contratoAnterior, error: contratoAnteriorErro } = await db.schema("pcm").from("preventiva_auvo_contrato").select("evidencia").eq("id", true).single();
    if (contratoAnteriorErro) throw contratoAnteriorErro;
    const evidenciasAnteriores = (contratoAnterior.evidencia ?? {}) as Record<string, unknown>;
    await db.schema("pcm").from("preventiva_auvo_contrato").update({ estado: "pendente", erro: null, updated_at: new Date().toISOString() }).eq("id", true);
    try {
      const [clienteR, tecnicoR, questionarioR, tipoR] = await Promise.all([
        db.schema("pcm").from("clientes").select("auvo_id").eq("id", input.clienteId).single(),
        db.schema("pcm").from("funcionarios").select("auvo_user_id").eq("id", input.tecnicoFuncionarioId).single(),
        db.schema("pcm").from("questionarios").select("auvo_id,ativo").eq("id", input.questionarioId).single(),
        db.schema("pcm").from("tipos_tarefa").select("auvo_id").eq("id", input.tipoTarefaId).single(),
      ]);
      const erro = [clienteR, tecnicoR, questionarioR, tipoR].find((x) => x.error)?.error;
      if (erro) throw erro;
      if (!clienteR.data.auvo_id || !tecnicoR.data.auvo_user_id || !questionarioR.data.auvo_id || !questionarioR.data.ativo || !tipoR.data.auvo_id) throw new HttpError(422, "Cadastro PCM sem vínculo Auvo suficiente para a validação");
      const chave = `PREV-CONTRATO-${input.alvoTipo}-${clienteR.data.auvo_id}-${input.equipamentoAuvoId}-${tipoR.data.auvo_id}`;
      const filtro = buildParamFilter({
        StartDate: new Date(Date.now() - 86_400_000).toISOString().slice(0, 19),
        EndDate: new Date(input.visitaEm).getTime() > Date.now()
          ? new Date(new Date(input.visitaEm).getTime() + 86_400_000).toISOString().slice(0, 19)
          : new Date(Date.now() + 86_400_000).toISOString().slice(0, 19),
        customerId: clienteR.data.auvo_id,
      });
      const alvoTeste = { externalId: chave, customerId: clienteR.data.auvo_id, equipmentId: input.equipamentoAuvoId, taskTypeId: tipoR.data.auvo_id };
      const existentes = await auvoGet<AuvoTasksResposta>(`/tasks?${filtro}`);
      let id = taskTesteExistente(existentes, alvoTeste);
      if (id == null) {
        const criada = await auvoPost<unknown>("/tasks", { externalId: chave, customerId: clienteR.data.auvo_id, taskTypeId: tipoR.data.auvo_id, equipmentId: input.equipamentoAuvoId, orientation: "TESTE DE CONTRATO PCM PREVENTIVAS — não executar", priority: 1 });
        id = taskId(criada);
        if (id == null) {
          const aposCriar = await auvoGet<AuvoTasksResposta>(`/tasks?${filtro}`);
          id = taskTesteExistente(aposCriar, alvoTeste);
        }
      }
      if (id == null) throw new Error("Auvo não devolveu ID da task de teste");
      await auvoPatch(`/tasks/${id}`, toAuvoJsonPatch({ idUserTo: tecnicoR.data.auvo_user_id, taskDate: input.visitaEm.slice(0, 19), questionnaireId: questionarioR.data.auvo_id }));
      const retorno = await auvoGet<unknown>(`/tasks/${id}`);
      const tarefa = ((retorno as { result?: Record<string, unknown> }).result ?? retorno) as Record<string, unknown>;
      const questionarios = Array.isArray(tarefa.questionnaires) ? tarefa.questionnaires : [];
      const questionarioOk = tarefa.questionnaireId === questionarioR.data.auvo_id || questionarios.some((q) => (q as { id?: number }).id === questionarioR.data.auvo_id);
      const ok = Number(tarefa.idUserTo) === tecnicoR.data.auvo_user_id && String(tarefa.taskDate ?? "").slice(0, 19) === input.visitaEm.slice(0, 19) && Number(tarefa.equipmentId) === input.equipamentoAuvoId && questionarioOk;
      const evidencia = { taskId: id, externalId: chave, tecnico: Number(tarefa.idUserTo) === tecnicoR.data.auvo_user_id, data: String(tarefa.taskDate ?? "").slice(0, 19) === input.visitaEm.slice(0, 19), alvo: Number(tarefa.equipmentId) === input.equipamentoAuvoId, questionario: questionarioOk };
      if (!ok) throw new Error("GET Auvo não confirmou todos os campos críticos");
      const evidencias = { ...evidenciasAnteriores, [input.alvoTipo]: evidencia };
      const completo = contratoPreventivoCompleto(evidencias);
      await db.schema("pcm").from("preventiva_auvo_contrato").update({ estado: completo ? "validado" : "pendente", validado_em: completo ? new Date().toISOString() : null, evidencia: evidencias, erro: null, updated_at: new Date().toISOString() }).eq("id", true);
      return resposta(200, { ok: true, completo, evidencia }, cors);
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "Falha ao validar contrato Auvo";
      await db.schema("pcm").from("preventiva_auvo_contrato").update({ estado: "falhou", erro: mensagem.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", true);
      throw erro;
    }
  } catch (erro) {
    const status = erro instanceof HttpError ? erro.status : erro instanceof z.ZodError ? 422 : 500;
    const detail = erro instanceof HttpError ? erro.message : erro instanceof z.ZodError ? "Entrada inválida" : "Não foi possível validar o contrato Auvo";
    return resposta(status, { title: "Error", status, detail }, cors);
  }
});
function resposta(status: number, body: unknown, cors: Record<string, string>): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } }); }
