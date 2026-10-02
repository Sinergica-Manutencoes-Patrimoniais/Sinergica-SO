// Confirma uma visita preventiva. Falha fechado: sem contrato Auvo validado não cria task.
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
  AuvoApiError,
  auvoGet,
  auvoPatch,
  auvoPost,
} from "../_shared/auvo/client.ts";
import { toAuvoJsonPatch } from "../_shared/auvo/json-patch.ts";
import { taskTemQuestionario } from "../_shared/auvo/task.ts";
import { classificarFalhaEnvioPreventiva } from "../_shared/preventivas/confirmacao.ts";

const FN = "pcm-preventivas-confirmar";
const Input = z.object({
  ocorrenciaId: z.string().uuid(),
  tecnicoFuncionarioId: z.string().uuid(),
  visitaEm: z.string().datetime(),
});

function podeEscrever(req: Request): boolean {
  const parte =
    (req.headers.get("Authorization")?.replace("Bearer ", "") ?? "").split(
      ".",
    )[1];
  try {
    const claims = JSON.parse(
      atob((parte ?? "").replace(/-/g, "+").replace(/_/g, "/")),
    );
    return claims.user_role === "superadmin" ||
      claims.user_modulos?.pcm === "escrita";
  } catch {
    return false;
  }
}
export function extrairTaskId(resposta: unknown): number | null {
  const corpo = resposta as {
    result?: unknown;
    id?: number;
    taskID?: number;
    taskId?: number;
  };
  if (Array.isArray(corpo?.result)) return extrairTaskId(corpo.result[0]);
  const result = corpo?.result as {
    id?: number;
    taskID?: number;
    taskId?: number;
  } | undefined;
  return result?.id ?? result?.taskID ?? result?.taskId ?? corpo?.id ??
    corpo?.taskID ?? corpo?.taskId ?? null;
}

export function tarefaPreventivaConfirmada(
  task: Record<string, unknown>,
  esperado: {
    tecnicoId: number;
    visitaEm: string;
    taskType: number;
    equipmentId: number;
    questionarioId: number;
    questionarioNome?: string;
  },
): boolean {
  const questionarioConfirmado = taskTemQuestionario(
    {
      questionnaireId: task.questionnaireId,
      questionnaires: task.questionnaires,
    },
    esperado.questionarioId,
    esperado.questionarioNome,
  );
  return Number(task.idUserTo) === esperado.tecnicoId &&
    String(task.taskDate ?? "").slice(0, 19) ===
      esperado.visitaEm.slice(0, 19) &&
    Number(task.taskType) === esperado.taskType &&
    Array.isArray(task.equipmentsId) &&
    task.equipmentsId.map(Number).includes(esperado.equipmentId) &&
    questionarioConfirmado;
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  const reqId = crypto.randomUUID().slice(0, 8);
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    const { userId } = await requireAuth(req);
    if (!podeEscrever(req)) {
      throw new HttpError(403, "Sem permissão de escrita no PCM");
    }
    const input = Input.parse(await req.json());
    if (new Date(input.visitaEm).getTime() < Date.now() - 86_400_000) {
      throw new HttpError(422, "A visita não pode ser agendada no passado");
    }
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: contrato, error: contratoErro } = await db.schema("pcm").from(
      "preventiva_auvo_contrato",
    ).select("estado").eq("id", true).single();
    if (contratoErro) throw contratoErro;
    if (contrato.estado !== "validado") {
      throw new HttpError(
        412,
        "Integração Auvo ainda não validou questionário, técnico, data e alvo. Nenhuma OS foi criada.",
      );
    }

    const { data: ocorrencia, error: ocorrenciaErro } = await db.schema("pcm")
      .from("ocorrencias_preventivas").select("*").eq("id", input.ocorrenciaId)
      .single();
    if (ocorrenciaErro) throw ocorrenciaErro;
    if (
      ocorrencia.envio_estado === "disponivel" &&
      ocorrencia.auvo_task_id != null
    ) {
      return json(200, {
        ok: true,
        taskId: ocorrencia.auvo_task_id,
        created: false,
      }, cors);
    }
    if (!["prevista", "falha"].includes(ocorrencia.envio_estado)) {
      throw new HttpError(
        409,
        "Esta ocorrência está sendo conciliada por outro envio.",
      );
    }

    const { data: tomada, error: tomadaErro } = await db.schema("pcm").from(
      "ocorrencias_preventivas",
    )
      .update({
        envio_estado: "enviando",
        tecnico_funcionario_id: input.tecnicoFuncionarioId,
        visita_em: input.visitaEm,
        erro_envio: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.ocorrenciaId).in("envio_estado", ["prevista", "falha"])
      .select("id");
    if (tomadaErro) throw tomadaErro;
    if (!tomada?.length) {
      throw new HttpError(
        409,
        "A ocorrência foi alterada por outro usuário. Atualize a tela.",
      );
    }

    let tentativaRemotaIniciada = false;
    let taskIdRemota: number | null = null;
    let osId: string | null = null;
    try {
      const { data: plano, error: planoErro } = await db.schema("pcm").from(
        "planos_preventivos",
      ).select("*").eq("id", ocorrencia.plano_id).single();
      if (planoErro) throw planoErro;
      if (plano.estado !== "ativo") {
        throw new HttpError(422, "O plano está pausado ou rascunho.");
      }
      const [clienteR, tecnicoR, questionarioR, tipoR, alvoR] = await Promise
        .all([
          db.schema("pcm").from("clientes").select("nome,auvo_id").eq(
            "id",
            plano.cliente_id,
          ).single(),
          db.schema("pcm").from("funcionarios").select("nome,auvo_user_id").eq(
            "id",
            input.tecnicoFuncionarioId,
          ).is("deleted_at", null).single(),
          db.schema("pcm").from("questionarios").select("nome,auvo_id,ativo")
            .eq("id", plano.questionario_id).single(),
          db.schema("pcm").from("tipos_tarefa").select("nome,auvo_id").eq(
            "id",
            plano.tipo_tarefa_id,
          ).is("deleted_at", null).single(),
          plano.sistema_id
            ? db.schema("pcm").from("sistemas").select("nome,auvo_equipment_id")
              .eq("id", plano.sistema_id).single()
            : db.schema("pcm").from("equipamentos").select(
              "nome,auvo_equipment_id",
            ).eq("id", plano.equipamento_id).single(),
        ]);
      const falha = [clienteR, tecnicoR, questionarioR, tipoR, alvoR].find((
        r,
      ) => r.error)?.error;
      if (falha) throw falha;
      const cliente = clienteR.data;
      const tecnico = tecnicoR.data;
      const questionario = questionarioR.data;
      const tipo = tipoR.data;
      const alvo = alvoR.data;
      if (
        !cliente?.auvo_id || !tecnico?.auvo_user_id ||
        !questionario?.auvo_id || !questionario.ativo || !tipo?.auvo_id ||
        !alvo?.auvo_equipment_id
      ) {
        throw new HttpError(
          422,
          "Cliente, técnico, alvo, tipo ou questionário ainda não possui vínculo Auvo válido.",
        );
      }
      const titulo = `Preventiva: ${plano.nome}`;
      const { data: osExistente, error: osExistenteErro } = await db.schema(
        "pcm",
      ).from("ordens_servico")
        .select("id,auvo_task_id").eq("ocorrencia_preventiva_id", ocorrencia.id)
        .maybeSingle();
      if (osExistenteErro) throw osExistenteErro;
      if (osExistente?.auvo_task_id != null) {
        throw new HttpError(
          409,
          "A task Auvo desta ocorrência precisa de reconciliação antes de nova confirmação.",
        );
      }
      const os = osExistente ??
        (await db.schema("pcm").from("ordens_servico").insert({
          client_id: plano.cliente_id,
          titulo,
          descricao:
            `Preventiva ${plano.nome} · alvo: ${alvo.nome} · questionário: ${questionario.nome}`,
          categoria: "preventiva",
          status: "planejamento",
          prioridade: "normal",
          origem: "preventiva_pcm",
          created_by: userId,
          tipo_tarefa_id: plano.tipo_tarefa_id,
          tecnico_funcionario_id: input.tecnicoFuncionarioId,
          data_agendada: input.visitaEm,
          ocorrencia_preventiva_id: ocorrencia.id,
          sistema_id: plano.sistema_id,
          equipamento_id: plano.equipamento_id,
          questionario_id: plano.questionario_id,
        }).select("id,auvo_task_id").single()).data;
      if (!os) {
        throw new Error("Não foi possível reservar a OS local preventiva");
      }
      osId = os.id;

      tentativaRemotaIniciada = true;
      const criada = await auvoPost<unknown>("/tasks", {
        externalId: os.id,
        customerId: cliente.auvo_id,
        taskType: tipo.auvo_id,
        equipmentsId: [alvo.auvo_equipment_id],
        idUserTo: tecnico.auvo_user_id,
        taskDate: input.visitaEm.slice(0, 19),
        questionnaireId: questionario.auvo_id,
        orientation: `PCM ${os.id} · ${titulo}`,
        priority: 2,
      });
      const taskId = extrairTaskId(criada);
      taskIdRemota = taskId;
      if (taskId == null) {
        throw new Error("Auvo não devolveu o identificador da tarefa criada");
      }
      await auvoPatch(
        `/tasks/${taskId}`,
        toAuvoJsonPatch({
          idUserTo: tecnico.auvo_user_id,
          taskDate: input.visitaEm.slice(0, 19),
          questionnaireId: questionario.auvo_id,
        }),
      );
      const lida = await auvoGet<unknown>(`/tasks/${taskId}`);
      const bruto = (lida as { result?: unknown }).result ?? lida;
      const task = (Array.isArray(bruto) ? bruto[0] : bruto) as Record<
        string,
        unknown
      >;
      if (
        !tarefaPreventivaConfirmada(task, {
          tecnicoId: tecnico.auvo_user_id,
          visitaEm: input.visitaEm,
          taskType: tipo.auvo_id,
          equipmentId: alvo.auvo_equipment_id,
          questionarioId: questionario.auvo_id,
          questionarioNome: questionario.nome,
        })
      ) {
        throw new Error(
          "Auvo não confirmou todos os campos críticos; tarefa ficará para reconciliação e não será disponibilizada.",
        );
      }
      const agora = new Date().toISOString();
      const [{ error: osUpdateErro }, { error: ocorrenciaUpdateErro }] =
        await Promise.all([
          db.schema("pcm").from("ordens_servico").update({
            auvo_task_id: taskId,
            auvo_sync_status: "synced",
            auvo_synced_at: agora,
            updated_at: agora,
          }).eq("id", os.id),
          db.schema("pcm").from("ocorrencias_preventivas").update({
            auvo_task_id: taskId,
            envio_estado: "disponivel",
            alvo_snapshot: {
              tipo: plano.sistema_id ? "sistema" : "equipamento",
              id: plano.sistema_id ?? plano.equipamento_id,
              nome: alvo.nome,
            },
            questionario_auvo_id: questionario.auvo_id,
            updated_at: agora,
          }).eq("id", ocorrencia.id),
        ]);
      if (osUpdateErro ?? ocorrenciaUpdateErro) {
        throw osUpdateErro ?? ocorrenciaUpdateErro;
      }
      return json(200, { ok: true, taskId, created: true }, cors);
    } catch (causa) {
      const mensagem = causa instanceof Error
        ? causa.message
        : "Falha inesperada ao abrir task Auvo";
      const rejeicaoRemotaConhecida = causa instanceof AuvoApiError &&
        causa.status >= 400 && causa.status < 500;
      const envioEstado = classificarFalhaEnvioPreventiva(
        tentativaRemotaIniciada,
        rejeicaoRemotaConhecida,
      );
      const agora = new Date().toISOString();
      await db.schema("pcm").from("ocorrencias_preventivas").update({
        envio_estado: envioEstado,
        erro_envio: mensagem.slice(0, 500),
        auvo_task_id: taskIdRemota,
        updated_at: agora,
      }).eq("id", input.ocorrenciaId);
      if (osId && taskIdRemota != null) {
        await db.schema("pcm").from("ordens_servico").update({
          auvo_task_id: taskIdRemota,
          auvo_sync_status: "failed",
          auvo_sync_error: mensagem.slice(0, 500),
          updated_at: agora,
        }).eq("id", osId);
      }
      throw causa;
    }
  } catch (causa) {
    if (causa instanceof HttpError) {
      return problem(causa.status, causa.message, reqId, cors);
    }
    if (causa instanceof z.ZodError) {
      return problem(422, "Entrada inválida", reqId, cors);
    }
    console.error(JSON.stringify({ fn: FN, reqId, erro: String(causa) }));
    return problem(500, "Não foi possível confirmar a visita", reqId, cors);
  }
});
function json(
  status: number,
  body: unknown,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
function problem(
  status: number,
  detail: string,
  reqId: string,
  cors: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ title: "Error", status, detail, reqId }),
    {
      status,
      headers: { "Content-Type": "application/problem+json", ...cors },
    },
  );
}
