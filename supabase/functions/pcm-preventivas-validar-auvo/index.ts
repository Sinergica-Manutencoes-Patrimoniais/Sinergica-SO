// Validação operacional explícita do contrato Auvo. Cria UMA task de teste e só libera
// preventivas se a leitura posterior confirmar técnico, data, alvo e questionário.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  getSupabaseServiceKey,
  HttpError,
  requireAuth,
} from "../_shared/auth.ts";
import {
  auvoGet,
  auvoPatch,
  auvoPost,
  buildParamFilter,
} from "../_shared/auvo/client.ts";
import { toAuvoJsonPatch } from "../_shared/auvo/json-patch.ts";
import { taskTemQuestionario } from "../_shared/auvo/task.ts";

const Input = z.object({
  clienteId: z.string().uuid(),
  tecnicoFuncionarioId: z.string().uuid(),
  questionarioId: z.string().uuid(),
  tipoTarefaId: z.string().uuid(),
  equipamentoAuvoId: z.number().int().positive(),
  alvoTipo: z.enum(["sistema", "equipamento"]),
  visitaEm: z.string().datetime(),
});
function claims(req: Request): Record<string, unknown> {
  try {
    const p =
      (req.headers.get("Authorization")?.replace("Bearer ", "") ?? "").split(
        ".",
      )[1];
    return JSON.parse(atob((p ?? "").replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}
/** Auvo v2 pode devolver o identificador diretamente em `result` ou em um objeto. */
export function taskId(valor: unknown): number | null {
  const x = valor as {
    result?: number | unknown[] | {
      id?: number;
      taskID?: number;
      taskId?: number;
    };
    id?: number;
    taskID?: number;
    taskId?: number;
  };
  if (typeof x.result === "number") return x.result;
  if (Array.isArray(x.result)) return taskId(x.result[0]);
  return x.result?.id ?? x.result?.taskID ?? x.result?.taskId ?? x.id ??
    x.taskID ?? x.taskId ?? null;
}

type AuvoTaskTeste = {
  taskID?: number;
  id?: number;
  taskId?: number;
  externalId?: string;
  customerId?: number;
  equipmentsId?: number[];
  taskType?: number;
  orientation?: string;
};

type AuvoTasksResposta = {
  result?: AuvoTaskTeste[] | { entityList?: AuvoTaskTeste[] };
};

function tarefasDaResposta(resposta: AuvoTasksResposta): AuvoTaskTeste[] {
  if (Array.isArray(resposta.result)) return resposta.result;
  return resposta.result?.entityList ?? [];
}

export function taskTesteExistente(
  resposta: AuvoTasksResposta,
  alvo: {
    externalId: string;
    customerId: number;
    equipmentId: number;
    taskTypeId: number;
  },
): number | null {
  const tarefas = tarefasDaResposta(resposta);
  const exata = tarefas.find((tarefa) =>
    tarefa.externalId === alvo.externalId &&
    tarefa.customerId === alvo.customerId &&
    tarefa.equipmentsId?.includes(alvo.equipmentId) &&
    tarefa.taskType === alvo.taskTypeId
  );
  const legada = tarefas.filter((tarefa) =>
    tarefa.orientation === "TESTE DE CONTRATO PCM PREVENTIVAS — não executar" &&
    tarefa.customerId === alvo.customerId &&
    tarefa.equipmentsId?.includes(alvo.equipmentId) &&
    tarefa.taskType === alvo.taskTypeId
  ).at(-1);
  // Orientação é compartilhada por todas as validações. Nunca é chave de
  // idempotência: reutilizaria task de outro alvo e mascararia o contrato real.
  return taskId(exata ?? legada ?? {});
}

/** Campos de criação confirmados no contrato Auvo v2. */
export function montarPayloadCriacaoTask(input: {
  externalId: string;
  customerId: number;
  taskType: number;
  equipmentId: number;
  idUserTo?: number;
  taskDate?: string;
  questionnaireId?: number;
}): Record<string, unknown> {
  return {
    externalId: input.externalId,
    customerId: input.customerId,
    taskType: input.taskType,
    equipmentsId: [input.equipmentId],
    ...(input.idUserTo == null ? {} : { idUserTo: input.idUserTo }),
    ...(input.taskDate == null ? {} : { taskDate: input.taskDate }),
    ...(input.questionnaireId == null
      ? {}
      : { questionnaireId: input.questionnaireId }),
    orientation: "TESTE DE CONTRATO PCM PREVENTIVAS — não executar",
    priority: 1,
  };
}

type EvidenciaTask = {
  tecnico: boolean;
  data: boolean;
  tipo: boolean;
  alvo: boolean;
  questionario: boolean;
};
export function evidenciaTaskPreventiva(
  tarefa: Record<string, unknown>,
  esperado: {
    tecnicoId: number;
    visitaEm: string;
    taskType: number;
    equipmentId: number;
    questionarioId: number;
    questionarioNome?: string;
  },
): EvidenciaTask {
  return {
    tecnico: Number(tarefa.idUserTo) === esperado.tecnicoId,
    data: String(tarefa.taskDate ?? "").slice(0, 19) ===
      esperado.visitaEm.slice(0, 19),
    tipo: Number(tarefa.taskType) === esperado.taskType,
    alvo: Array.isArray(tarefa.equipmentsId) &&
      tarefa.equipmentsId.map(Number).includes(esperado.equipmentId),
    questionario: taskTemQuestionario(
      {
        questionnaireId: tarefa.questionnaireId,
        questionnaires: tarefa.questionnaires,
      },
      esperado.questionarioId,
      esperado.questionarioNome,
    ),
  };
}

/** Diagnóstico sem payload completo: suficiente para corrigir contrato sem registrar dados da task. */
export function resumoRespostaCriacaoTask(valor: unknown): string {
  if (valor === null) return "null";
  if (Array.isArray(valor)) return `array(${valor.length})`;
  if (typeof valor !== "object") return typeof valor;
  const corpo = valor as Record<string, unknown>;
  const chaves = Object.keys(corpo).sort().join(",");
  const result = corpo.result;
  const resumoResult = result === null
    ? "null"
    : Array.isArray(result)
    ? `array(${result.length})${
      result[0] && typeof result[0] === "object"
        ? `:obj(${
          Object.keys(result[0] as Record<string, unknown>).sort().join(",")
        })`
        : ""
    }`
    : typeof result === "object"
    ? `obj(${Object.keys(result as Record<string, unknown>).sort().join(",")})`
    : `${typeof result}:${String(result).slice(0, 120)}`;
  const mensagem = typeof corpo.message === "string"
    ? ` message:${corpo.message.slice(0, 180)}`
    : "";
  return `campos:${chaves}; result:${resumoResult}${mensagem}`;
}

/** Diagnóstico de formato sem valores da task. */
export function resumoCamposTaskAuvo(tarefa: Record<string, unknown>): string {
  const campos = Object.keys(tarefa).sort().join(",");
  const questionarios = tarefa.questionnaires;
  if (Array.isArray(questionarios)) {
    const primeiro = questionarios[0];
    const camposQuestionario = primeiro && typeof primeiro === "object"
      ? Object.keys(primeiro as Record<string, unknown>).sort().join(",")
      : typeof primeiro;
    return `${campos}; questionnaires:array(${camposQuestionario})`;
  }
  if (questionarios && typeof questionarios === "object") {
    return `${campos}; questionnaires:object(${
      Object.keys(questionarios as Record<string, unknown>).sort().join(",")
    })`;
  }
  return `${campos}; questionnaires:${typeof questionarios}`;
}

type EvidenciaAlvo = {
  tecnico?: boolean;
  data?: boolean;
  tipo?: boolean;
  alvo?: boolean;
  questionario?: boolean;
};
export function contratoPreventivoCompleto(
  evidencia: Record<string, unknown>,
): boolean {
  return ["sistema", "equipamento"].every((tipo) => {
    const item = evidencia[tipo] as EvidenciaAlvo | undefined;
    return item?.tecnico === true && item.data === true && item.tipo === true &&
      item.alvo === true && item.questionario === true;
  });
}

if (import.meta.main) {
  serve(async (req) => {
    const cors = corsHeaders(req.headers.get("Origin"));
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    try {
      if (req.method !== "POST") {
        throw new HttpError(405, "Método não permitido");
      }
      await requireAuth(req);
      const c = claims(req);
      if (c.user_role !== "superadmin") {
        throw new HttpError(
          403,
          "Somente superadmin pode validar o contrato Auvo",
        );
      }
      const input = Input.parse(await req.json());
      if (
        new Date(input.visitaEm).getTime() <= Date.now()
      ) {
        throw new HttpError(422, "Use uma data futura para a task de teste");
      }
      const db = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        getSupabaseServiceKey(),
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data: contratoAnterior, error: contratoAnteriorErro } = await db
        .schema("pcm").from("preventiva_auvo_contrato").select(
          "evidencia,estado",
        ).eq("id", true).single();
      if (contratoAnteriorErro) {
        throw contratoAnteriorErro;
      }
      const evidenciasAnteriores = (contratoAnterior.evidencia ?? {}) as Record<
        string,
        unknown
      >;
      await db.schema("pcm").from("preventiva_auvo_contrato").update({
        estado: "pendente",
        erro: null,
        updated_at: new Date().toISOString(),
      }).eq("id", true);
      try {
        const [clienteR, tecnicoR, questionarioR, tipoR] = await Promise.all([
          db.schema("pcm").from("clientes").select("auvo_id").eq(
            "id",
            input.clienteId,
          ).single(),
          db.schema("pcm").from("funcionarios").select("auvo_user_id").eq(
            "id",
            input.tecnicoFuncionarioId,
          ).single(),
          db.schema("pcm").from("questionarios").select("auvo_id,ativo,nome")
            .eq(
              "id",
              input.questionarioId,
            ).single(),
          db.schema("pcm").from("tipos_tarefa").select("auvo_id").eq(
            "id",
            input.tipoTarefaId,
          ).single(),
        ]);
        const erro = [clienteR, tecnicoR, questionarioR, tipoR].find((x) =>
          x.error
        )?.error;
        if (erro) {
          throw erro;
        }
        const cliente = clienteR.data;
        const tecnico = tecnicoR.data;
        const questionario = questionarioR.data;
        const tipo = tipoR.data;
        if (
          !cliente?.auvo_id || !tecnico?.auvo_user_id ||
          !questionario?.auvo_id || !questionario.ativo || !tipo?.auvo_id
        ) {
          throw new HttpError(
            422,
            "Cadastro PCM sem vínculo Auvo suficiente para a validação",
          );
        }
        const chave =
          `PREV-CONTRATO-${input.alvoTipo}-${cliente.auvo_id}-${input.equipamentoAuvoId}-${tipo.auvo_id}`;
        const filtro = buildParamFilter({
          StartDate: new Date(Date.now() - 86_400_000).toISOString().slice(
            0,
            19,
          ),
          EndDate: new Date(input.visitaEm).getTime() > Date.now()
            ? new Date(new Date(input.visitaEm).getTime() + 86_400_000)
              .toISOString().slice(0, 19)
            : new Date(Date.now() + 86_400_000).toISOString().slice(0, 19),
          customerId: cliente.auvo_id,
        });
        const alvoTeste = {
          externalId: chave,
          customerId: cliente.auvo_id,
          equipmentId: input.equipamentoAuvoId,
          taskTypeId: tipo.auvo_id,
        };
        const existentes = await auvoGet<AuvoTasksResposta>(`/tasks?${filtro}`);
        let id = taskTesteExistente(existentes, alvoTeste);
        let respostaCriacao: unknown = null;
        if (id == null) {
          if (contratoAnterior.estado === "falhou") {
            throw new HttpError(
              409,
              "Task-teste anterior não foi localizada no Auvo; nenhuma nova task será criada automaticamente.",
            );
          }
          const criada = await auvoPost<unknown>(
            "/tasks",
            montarPayloadCriacaoTask({
              externalId: chave,
              customerId: cliente.auvo_id,
              taskType: tipo.auvo_id,
              equipmentId: input.equipamentoAuvoId,
              idUserTo: tecnico.auvo_user_id,
              taskDate: input.visitaEm.slice(0, 19),
              questionnaireId: questionario.auvo_id,
            }),
          );
          respostaCriacao = criada;
          id = taskId(criada);
          if (id == null) {
            const aposCriar = await auvoGet<AuvoTasksResposta>(
              `/tasks?${filtro}`,
            );
            id = taskTesteExistente(aposCriar, alvoTeste);
          }
        }
        if (id == null) {
          throw new Error(
            `Auvo não devolveu ID da task de teste (${
              resumoRespostaCriacaoTask(respostaCriacao)
            })`,
          );
        }
        await auvoPatch(
          `/tasks/${id}`,
          toAuvoJsonPatch({
            idUserTo: tecnico.auvo_user_id,
            taskDate: input.visitaEm.slice(0, 19),
            questionnaireId: questionario.auvo_id,
          }),
        );
        const retorno = await auvoGet<unknown>(`/tasks/${id}`);
        const bruto = (retorno as { result?: unknown }).result ?? retorno;
        const tarefa = (Array.isArray(bruto) ? bruto[0] : bruto) as Record<
          string,
          unknown
        >;
        const evidencia = {
          taskId: id,
          externalId: chave,
          ...evidenciaTaskPreventiva(tarefa, {
            tecnicoId: tecnico.auvo_user_id,
            visitaEm: input.visitaEm,
            taskType: tipo.auvo_id,
            equipmentId: input.equipamentoAuvoId,
            questionarioId: questionario.auvo_id,
            questionarioNome: questionario.nome,
          }),
        };
        const evidenciaComDiagnostico = evidencia.questionario ? evidencia : {
          ...evidencia,
          questionarioFormato: resumoCamposTaskAuvo(tarefa),
        };
        const ok = evidencia.tecnico && evidencia.data && evidencia.tipo &&
          evidencia.alvo && evidencia.questionario;
        if (!ok) {
          await db.schema("pcm").from("preventiva_auvo_contrato").update({
            evidencia: {
              ...evidenciasAnteriores,
              [input.alvoTipo]: evidenciaComDiagnostico,
            },
            updated_at: new Date().toISOString(),
          }).eq("id", true);
          throw new Error(
            `GET Auvo não confirmou campos críticos (tecnico=${evidencia.tecnico}; data=${evidencia.data}; tipo=${evidencia.tipo}; alvo=${evidencia.alvo}; questionario=${evidencia.questionario})`,
          );
        }
        const evidencias = {
          ...evidenciasAnteriores,
          [input.alvoTipo]: evidenciaComDiagnostico,
        };
        const completo = contratoPreventivoCompleto(evidencias);
        await db.schema("pcm").from("preventiva_auvo_contrato").update({
          estado: completo ? "validado" : "pendente",
          validado_em: completo ? new Date().toISOString() : null,
          evidencia: evidencias,
          erro: null,
          updated_at: new Date().toISOString(),
        }).eq("id", true);
        return resposta(200, { ok: true, completo, evidencia }, cors);
      } catch (erro) {
        const mensagem = erro instanceof Error
          ? erro.message
          : "Falha ao validar contrato Auvo";
        await db.schema("pcm").from("preventiva_auvo_contrato").update({
          estado: "falhou",
          erro: mensagem.slice(0, 500),
          updated_at: new Date().toISOString(),
        }).eq("id", true);
        throw erro;
      }
    } catch (erro) {
      const status = erro instanceof HttpError
        ? erro.status
        : erro instanceof z.ZodError
        ? 422
        : 500;
      const detail = erro instanceof HttpError
        ? erro.message
        : erro instanceof z.ZodError
        ? "Entrada inválida"
        : "Não foi possível validar o contrato Auvo";
      return resposta(status, { title: "Error", status, detail }, cors);
    }
  });
}
function resposta(
  status: number,
  body: unknown,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
