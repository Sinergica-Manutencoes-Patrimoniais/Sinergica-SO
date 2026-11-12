import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import type { ValidacaoOsGateway } from "../application/validacao-os-gateway";

const perguntaSchema = z.object({ id: z.string(), texto: z.string().nullable() }).strict();
const retornoClassificavelSchema = z
  .object({
    envelope_id: z.string().guid(),
    resolucao_id: z.string().guid(),
    os_id: z.string().guid(),
    task_id: z.string(),
    ocorrido_em: z.string(),
    recebido_em: z.string(),
    perguntas: z.array(perguntaSchema),
  })
  .strict()
  .transform((v) => ({
    envelopeId: v.envelope_id,
    resolucaoId: v.resolucao_id,
    osId: v.os_id,
    taskId: v.task_id,
    ocorridoEm: v.ocorrido_em,
    recebidoEm: v.recebido_em,
    perguntas: v.perguntas,
  }));

const resultadoClassificacaoSchema = z
  .object({
    requestId: z.string().guid(),
    retornoId: z.string().guid(),
    coberturaComprovada: z.literal(false),
  })
  .strict();

const conferenciaCoberturaSchema = z
  .object({
    id: z.string().guid(),
    evidencia_id: z.string().guid(),
    revisao_evidencias: z.number().int(),
    perguntas: z.number().int(),
    justificativa: z.string(),
    ator_id: z.string().guid(),
    criado_em: z.string(),
  })
  .strict()
  .transform((v) => ({
    id: v.id,
    evidenciaId: v.evidencia_id,
    revisaoEvidencias: v.revisao_evidencias,
    perguntas: v.perguntas,
    justificativa: v.justificativa,
    atorId: v.ator_id,
    criadoEm: v.criado_em,
  }));

const resultadoConferenciaSchema = z
  .object({
    conferenciaId: z.string().guid(),
    retornoId: z.string().guid(),
    coberturaEstrutural: z.literal(true),
    evidenciaExternaComprovada: z.literal(false),
    requestId: z.string().guid(),
  })
  .strict();

const resultadoAprovacaoSchema = z
  .object({
    requestId: z.string().guid(),
    retornoId: z.string().guid(),
    osId: z.string().guid(),
    revision: z.number().int(),
    pendenciasProcessadas: z.number().int().nonnegative(),
    osEncerrada: z.literal(true),
    chamadoAlterado: z.literal(false),
    conteudoAutenticado: z.literal(false),
  })
  .strict();

export const supabaseValidacaoOsAdapter: ValidacaoOsGateway = {
  async listarRetornosClassificaveis(c, signal) {
    if (!Number.isSafeInteger(c.limite) || c.limite < 1 || c.limite > 100)
      throw new Error("Paginação inválida.");
    let consulta = supabase.schema("pcm").rpc("sso_listar_retornos_classificaveis_mediada", {
      p_cliente_id: c.clienteId,
      p_apos: c.apos,
      p_limite: c.limite,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return z.array(retornoClassificavelSchema).parse(data);
  },
  async classificarRetorno(c) {
    const { data, error } = await supabase
      .schema("pcm")
      .rpc("sso_classificar_retorno_campo_mediada", {
        p_request_id: c.requestId,
        p_cliente_id: c.clienteId,
        p_envelope_id: c.envelopeId,
        p_resolucao_id: c.resolucaoId,
        p_retorno_id: c.retornoId,
        p_respostas: c.respostas,
      });
    if (error) throw error;
    const resultado = resultadoClassificacaoSchema.parse(data);
    if (
      resultado.requestId.toLowerCase() !== c.requestId.toLowerCase() ||
      resultado.retornoId.toLowerCase() !== c.retornoId.toLowerCase()
    )
      throw new Error("Resposta de classificação não corresponde ao pedido.");
    return resultado;
  },
  async listarConferenciasCobertura(c, signal) {
    if (!Number.isSafeInteger(c.limite) || c.limite < 1 || c.limite > 100)
      throw new Error("Paginação inválida.");
    let consulta = supabase.schema("pcm").rpc("sso_listar_conferencias_cobertura_mediada", {
      p_cliente_id: c.clienteId,
      p_retorno_id: c.retornoId,
      p_apos: c.apos,
      p_limite: c.limite,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return z.array(conferenciaCoberturaSchema).parse(data);
  },
  async conferirCoberturaRetorno(c) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_conferir_cobertura_mediada", {
      p_request_id: c.requestId,
      p_cliente_id: c.clienteId,
      p_retorno_id: c.retornoId,
      p_evidencia_id: c.evidenciaId,
      p_expected_evidencias: c.expectedEvidencias,
      p_justificativa: c.justificativa,
    });
    if (error) throw error;
    const resultado = resultadoConferenciaSchema.parse(data);
    if (
      resultado.requestId.toLowerCase() !== c.requestId.toLowerCase() ||
      resultado.retornoId.toLowerCase() !== c.retornoId.toLowerCase()
    )
      throw new Error("Resposta de conferência não corresponde ao pedido.");
    return {
      conferenciaId: resultado.conferenciaId,
      retornoId: resultado.retornoId,
      requestId: resultado.requestId,
    };
  },
  async aprovarFinalizarOs(c) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_aprovar_finalizar_os_atomico", {
      p_request_id: c.requestId,
      p_cliente_id: c.clienteId,
      p_retorno_id: c.retornoId,
      p_conferencia_id: c.conferenciaId,
      p_expected_evidencias: c.expectedEvidencias,
      p_expected_decisao: c.expectedDecisao,
      p_justificativa: c.justificativa,
      p_expected_os_id: c.expectedOsId,
      p_expected_status: c.expectedStatus,
      p_expected_updated_at: c.expectedUpdatedAt,
    });
    if (error) throw error;
    const resultado = resultadoAprovacaoSchema.parse(data);
    if (
      resultado.requestId.toLowerCase() !== c.requestId.toLowerCase() ||
      resultado.retornoId.toLowerCase() !== c.retornoId.toLowerCase() ||
      resultado.osId.toLowerCase() !== c.expectedOsId.toLowerCase()
    )
      throw new Error("Resposta de aprovação/finalização não corresponde ao pedido.");
    return resultado;
  },
};
