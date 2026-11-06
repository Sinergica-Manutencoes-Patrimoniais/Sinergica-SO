import { supabase } from "../../../lib/supabase-client";
import { calcularDisponibilidade } from "../domain/capacidade-agenda";

export type DisponibilidadeDeclarada = {
  id: string;
  funcionarioId: string;
  semanaInicio: string;
  revisao: number;
  destinadosMinutos: number;
  reservasMinutos: number;
  ausenciasMinutos: number;
  disponiveisMinutos: number | null;
};

export async function listarDisponibilidades(
  clienteId: string,
  semanaInicio: string,
  aposId: string | null,
  signal?: AbortSignal,
): Promise<DisponibilidadeDeclarada[]> {
  let consulta = supabase
    .schema("pcm")
    .from("capacidade_disponibilidades")
    .select(
      "id,cliente_id,funcionario_id,semana_inicio,revisao,destinados_minutos,reservas_minutos,ausencias_minutos",
    )
    .eq("cliente_id", clienteId)
    .eq("semana_inicio", semanaInicio)
    .order("id")
    .limit(20);
  if (aposId) consulta = consulta.gt("id", aposId);
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta;
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Disponibilidade indisponível.");
  return data.map((r) => {
    if (
      r.cliente_id !== clienteId ||
      r.semana_inicio !== semanaInicio ||
      typeof r.id !== "string" ||
      typeof r.funcionario_id !== "string" ||
      !Number.isSafeInteger(r.revisao) ||
      r.revisao < 1 ||
      !Number.isSafeInteger(r.destinados_minutos) ||
      !Number.isSafeInteger(r.reservas_minutos) ||
      !Number.isSafeInteger(r.ausencias_minutos)
    )
      throw new Error("Disponibilidade inválida.");
    const calculo = calcularDisponibilidade({
      destinadosMinutos: r.destinados_minutos,
      reservasMinutos: r.reservas_minutos,
      ausenciasMinutos: r.ausencias_minutos,
    });
    return {
      id: r.id,
      funcionarioId: r.funcionario_id,
      semanaInicio: r.semana_inicio,
      revisao: r.revisao,
      destinadosMinutos: r.destinados_minutos,
      reservasMinutos: r.reservas_minutos,
      ausenciasMinutos: r.ausencias_minutos,
      disponiveisMinutos: calculo.disponiveisMinutos,
    };
  });
}

export type PedidoDisponibilidade = {
  requestId: string;
  id: string;
  clienteId: string;
  funcionarioId: string;
  semanaInicio: string;
  destinados: number;
  reservas: number;
  ausencias: number;
  expectedRevision: number;
  confirmacaoSemSobreposicao: boolean;
};
export async function salvarDisponibilidade(p: PedidoDisponibilidade): Promise<void> {
  const { data, error } = await supabase.schema("pcm").rpc("sso_salvar_disponibilidade_semanal", {
    p_request_id: p.requestId,
    p_id: p.id,
    p_cliente_id: p.clienteId,
    p_funcionario_id: p.funcionarioId,
    p_semana_inicio: p.semanaInicio,
    p_destinados: p.destinados,
    p_reservas: p.reservas,
    p_ausencias: p.ausencias,
    p_confirmacao_sem_sobreposicao: p.confirmacaoSemSobreposicao,
    p_expected_revision: p.expectedRevision,
  });
  if (error) throw error;
  if (
    !data ||
    data.aggregateId !== p.id ||
    data.requestId !== p.requestId ||
    data.revision !== p.expectedRevision + 1 ||
    data.state !== "declarada"
  )
    throw new Error("Resposta de disponibilidade inválida.");
}

export async function listarVinculosCapacidade(
  clienteId: string,
  semanaInicio: string,
  apos: string | null,
  signal?: AbortSignal,
) {
  let chamada = supabase
    .schema("pcm")
    .rpc("sso_listar_vinculos_capacidade_visita", {
      p_cliente_id: clienteId,
      p_semana_inicio: semanaInicio,
      p_apos: apos,
      p_limite: 20,
    });
  if (signal) chamada = chamada.abortSignal(signal);
  const { data, error } = await chamada;
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Vínculos de Visita inválidos.");
  return data.map((r) => {
    if (
      typeof r.participacao_id !== "string" ||
      typeof r.visita_id !== "string" ||
      typeof r.funcionario_id !== "string" ||
      typeof r.inicio_em !== "string" ||
      typeof r.fuso !== "string" ||
      (r.estimativa_minutos !== null &&
        (!Number.isSafeInteger(r.estimativa_minutos) || r.estimativa_minutos <= 0))
    )
      throw new Error("Vínculo de Visita inválido.");
    return {
      id: r.participacao_id as string,
      visitaId: r.visita_id as string,
      funcionarioId: r.funcionario_id as string,
      inicioEm: r.inicio_em as string,
      fuso: r.fuso as string,
      estimativaMinutos: r.estimativa_minutos as number | null,
    };
  });
}
