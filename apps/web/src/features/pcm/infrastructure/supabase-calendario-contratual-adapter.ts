import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import type {
  ConsultarContratosCalendarioGateway,
  ConsultarRegrasCalendarioGateway,
  CriarRegraContratualGateway,
} from "../application/calendario-contratual-gateway";

// Somente erros retornados pela RPC com rejeição HTTP da transação recebem esta marca local.
const rejeicoesTransacionais = new WeakSet<object>();
export function rejeicaoInicialRegraComprovada(error: unknown): boolean {
  return typeof error === "object" && error !== null && rejeicoesTransacionais.has(error);
}

const resultadoSchema = z
  .object({
    aggregateId: z.string().guid(),
    revision: z.number().int().positive(),
    state: z.string(),
    created: z.boolean(),
    linkedIds: z.record(z.string(), z.string()),
    warnings: z.array(z.string()),
    requestId: z.string().guid(),
  })
  .strict();
export type PedidoAlterarDia = {
  requestId: string;
  serieId: string;
  regraNovaId: string;
  expectedRevision: number;
  diaSemana: number;
  vigencia: string;
};
export async function alterarDiaContratual(c: PedidoAlterarDia) {
  const { data, error } = await supabase.schema("pcm").rpc("sso_alterar_dia_contratual", {
    p_request_id: c.requestId,
    p_serie_id: c.serieId,
    p_regra_nova_id: c.regraNovaId,
    p_expected_revision: c.expectedRevision,
    p_dia_semana: c.diaSemana,
    p_vigencia: c.vigencia,
  });
  if (error) throw error;
  if (
    !data ||
    data.requestId !== c.requestId ||
    data.serieId !== c.serieId ||
    data.regraId !== c.regraNovaId ||
    data.revision !== c.expectedRevision + 1
  )
    throw new Error("Resposta de alteração inválida.");
}
export const supabaseCalendarioContratualAdapter: CriarRegraContratualGateway &
  ConsultarContratosCalendarioGateway &
  ConsultarRegrasCalendarioGateway = {
  async listarRegras(clienteId, limite, apos, signal) {
    if (!Number.isSafeInteger(limite) || limite < 1 || limite > 100)
      throw new Error("Paginação inválida.");
    let consulta = supabase.schema("pcm").rpc("sso_listar_regras_calendario", {
      p_cliente_id: clienteId,
      p_limite: limite,
      p_apos: apos,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return z
      .array(
        z
          .object({
            id: z.string().guid(),
            serie_id: z.string().guid(),
            contrato_id: z.string().guid(),
            numero: z.number().int().positive(),
            ancora_semana: z.string(),
            dia_semana: z.number().int().min(1).max(7),
            intervalo_semanas: z.number().int().positive(),
            hora_inicio: z.string(),
            duracao_minutos: z.number().int().positive(),
            deslocamento_minutos: z.number().int().nonnegative(),
            fuso: z.string(),
            vigencia_inicio: z.string(),
            vigencia_fim: z.string().nullable(),
          })
          .strict()
          .transform((r) => ({
            id: r.id,
            serieId: r.serie_id,
            contratoId: r.contrato_id,
            numero: r.numero,
            ancoraSemana: r.ancora_semana,
            diaSemana: r.dia_semana,
            intervaloSemanas: r.intervalo_semanas,
            horaInicio: r.hora_inicio,
            duracaoMinutos: r.duracao_minutos,
            deslocamentoMinutos: r.deslocamento_minutos,
            fuso: r.fuso,
            vigenciaInicio: r.vigencia_inicio,
            vigenciaFim: r.vigencia_fim,
          })),
      )
      .parse(data);
  },
  async listarContratos(clienteId, limite, apos, signal) {
    if (!Number.isSafeInteger(limite) || limite < 1 || limite > 100)
      throw new Error("Paginação inválida.");
    let consulta = supabase.schema("pcm").rpc("sso_listar_contratos_calendario", {
      p_cliente_id: clienteId,
      p_limite: limite,
      p_apos: apos,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return z
      .array(
        z
          .object({
            id: z.string().guid(),
            tipo: z.enum(["residente", "volante", "avulso"]),
            status: z.enum(["rascunho", "ativo", "suspenso", "encerrado"]),
            vigencia_inicio: z.string(),
            vigencia_fim: z.string().nullable(),
          })
          .strict()
          .transform((c) => ({
            id: c.id,
            tipo: c.tipo,
            status: c.status,
            vigenciaInicio: c.vigencia_inicio,
            vigenciaFim: c.vigencia_fim,
          })),
      )
      .parse(data);
  },
  async criarRegra(c) {
    const { data, error, status } = await supabase
      .schema("pcm")
      .rpc("sso_criar_regra_contratual_v2", {
        p_request_id: c.requestId,
        p_expected_revision: c.expectedRevision,
        p_cliente_id: c.clienteId,
        p_serie_id: c.serieId,
        p_regra_id: c.regraId,
        p_contrato_id: c.contratoId,
        p_ancora_semana: c.ancoraSemana,
        p_dia_semana: c.diaSemana,
        p_intervalo_semanas: c.intervaloSemanas,
        p_hora_inicio: c.horaInicio,
        p_duracao_minutos: c.duracaoMinutos,
        p_deslocamento_minutos: c.deslocamentoMinutos,
        p_fuso: c.fuso,
        p_vigencia_inicio: c.vigenciaInicio,
        p_vigencia_fim: c.vigenciaFim,
      });
    if (error) {
      if (status === 400 && ["22023", "23514", "P0011"].includes(error.code))
        rejeicoesTransacionais.add(error);
      throw error;
    }
    const resultado = resultadoSchema.parse(data);
    const iguais = (a: string | undefined, b: string) => a?.toLowerCase() === b.toLowerCase();
    if (
      !iguais(resultado.requestId, c.requestId) ||
      !iguais(resultado.aggregateId, c.serieId) ||
      !iguais(resultado.linkedIds.clienteId, c.clienteId) ||
      !iguais(resultado.linkedIds.contratoId, c.contratoId) ||
      !iguais(resultado.linkedIds.regraId, c.regraId) ||
      resultado.revision !== 1 ||
      resultado.state !== "registrada" ||
      resultado.created !== true
    )
      throw new Error("Resposta da regra contratual não corresponde ao pedido.");
    return resultado;
  },
};
