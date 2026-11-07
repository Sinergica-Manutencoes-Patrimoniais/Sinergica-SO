import { semanaCapacidade } from "./semana-capacidade";

export interface EstimativaEsforco {
  duracaoMinutos: number | null;
  tecnicos: number | null;
  quantidade: number | null;
  tipoTempo: "total" | "por_unidade" | null;
}

export interface ParametrosDisponibilidade {
  destinadosMinutos: number | null;
  reservasMinutos: number | null;
  ausenciasMinutos: number | null;
}

/**
 * Projeção com parâmetros explícitos; ausência de dados não significa zero.
 * Reservas e ausências devem representar intervalos sem sobreposição entre si.
 * Este cálculo não recebe intervalos e não consegue verificar essa condição.
 */
export function calcularDisponibilidade(
  entrada: ParametrosDisponibilidade,
): ParametrosDisponibilidade & { disponiveisMinutos: number | null } {
  const { destinadosMinutos, reservasMinutos, ausenciasMinutos } = entrada;
  for (const valor of [destinadosMinutos, reservasMinutos, ausenciasMinutos]) {
    if (valor !== null && (!Number.isSafeInteger(valor) || valor < 0))
      throw new Error("Disponibilidade inválida.");
  }
  if (destinadosMinutos === null || reservasMinutos === null || ausenciasMinutos === null)
    return { ...entrada, disponiveisMinutos: null };
  if (reservasMinutos > destinadosMinutos || ausenciasMinutos > destinadosMinutos - reservasMinutos)
    throw new Error("Descontos excedem tempo destinado.");
  return { ...entrada, disponiveisMinutos: destinadosMinutos - reservasMinutos - ausenciasMinutos };
}

/** Minutos-homem previstos, não comprova disponibilidade nem programação. */
export function calcularEsforcoEstimado(entrada: EstimativaEsforco): number | null {
  if (
    entrada.tipoTempo !== null &&
    entrada.tipoTempo !== "total" &&
    entrada.tipoTempo !== "por_unidade"
  )
    throw new Error("Estimativa inválida.");
  for (const valor of [entrada.duracaoMinutos, entrada.tecnicos, entrada.quantidade]) {
    if (valor !== null && (!Number.isSafeInteger(valor) || valor < 0))
      throw new Error("Estimativa inválida.");
  }
  if (
    !entrada.duracaoMinutos ||
    !entrada.tecnicos ||
    !entrada.tipoTempo ||
    (entrada.tipoTempo === "por_unidade" && !entrada.quantidade)
  )
    return null;
  const fator = entrada.tipoTempo === "por_unidade" ? entrada.quantidade! : 1;
  const resultado = entrada.duracaoMinutos * entrada.tecnicos * fator;
  if (!Number.isSafeInteger(resultado)) throw new Error("Estimativa excede precisão segura.");
  return resultado;
}

export type SemanaSimulacao = {
  semanaInicio: string;
  disponiveisMinutos: number | null;
  demandaMinutos: number | null;
  completa: boolean;
};

/** Cálculo puro; a cobertura informada precisa ser comprovada pela fonte autorizada. */
export function simularRemanejamento(pedido: {
  vencimento: string;
  programada: string | null;
  destino: string;
  esforcoMinutos: number | null;
  origem: SemanaSimulacao;
  destinoSemana: SemanaSimulacao;
  equipe: { simultaneidade: boolean | null; qualificacao: boolean | null; conflito: boolean | null };
}) {
  const baseline = semanaCapacidade(pedido.vencimento);
  const origem = semanaCapacidade(pedido.programada ?? pedido.vencimento);
  const destino = semanaCapacidade(pedido.destino);
  if (!baseline || !origem || !destino || pedido.origem.semanaInicio !== origem.inicio || pedido.destinoSemana.semanaInicio !== destino.inicio)
    throw new Error("Semana incompatível com a programação.");
  for (const valor of [pedido.esforcoMinutos, pedido.origem.disponiveisMinutos, pedido.origem.demandaMinutos, pedido.destinoSemana.disponiveisMinutos, pedido.destinoSemana.demandaMinutos]) {
    if (valor !== null && (!Number.isSafeInteger(valor) || valor < 0)) throw new Error("Capacidade inválida.");
  }
  if (typeof pedido.origem.completa !== "boolean" || typeof pedido.destinoSemana.completa !== "boolean" ||
    [pedido.equipe.simultaneidade, pedido.equipe.qualificacao, pedido.equipe.conflito].some((valor) => valor !== null && typeof valor !== "boolean"))
    throw new Error("Verificação de capacidade inválida.");
  if (pedido.esforcoMinutos === 0) throw new Error("Esforço não pode ser zero.");
  const saldo = (s: SemanaSimulacao): number | null =>
    s.completa && s.disponiveisMinutos !== null && s.demandaMinutos !== null
      ? s.disponiveisMinutos - s.demandaMinutos
      : null;
  const antesOrigem = saldo(pedido.origem);
  const antesDestino = saldo(pedido.destinoSemana);
  const mesmaSemana = origem.inicio === destino.inicio;
  if (mesmaSemana && (pedido.origem.completa !== pedido.destinoSemana.completa || pedido.origem.disponiveisMinutos !== pedido.destinoSemana.disponiveisMinutos || pedido.origem.demandaMinutos !== pedido.destinoSemana.demandaMinutos))
    throw new Error("Fotografias da mesma semana divergentes.");
  if (antesOrigem !== null && pedido.esforcoMinutos !== null && pedido.esforcoMinutos > pedido.origem.demandaMinutos!)
    throw new Error("Esforço excede demanda da origem.");
  const depoisOrigem = mesmaSemana ? antesOrigem : antesOrigem !== null && pedido.esforcoMinutos !== null ? antesOrigem + pedido.esforcoMinutos : null;
  const depoisDestino = mesmaSemana ? antesDestino : antesDestino !== null && pedido.esforcoMinutos !== null ? antesDestino - pedido.esforcoMinutos : null;
  if ((depoisOrigem !== null && !Number.isSafeInteger(depoisOrigem)) || (depoisDestino !== null && !Number.isSafeInteger(depoisDestino))) throw new Error("Saldo excede precisão segura.");
  const alertas: string[] = [];
  if (depoisOrigem === null || depoisDestino === null || pedido.esforcoMinutos === null) alertas.push("capacidade_nao_verificada");
  if (depoisDestino !== null && depoisDestino < 0) alertas.push("sobrecarga");
  if (pedido.equipe.simultaneidade === false) alertas.push("simultaneidade_incompativel");
  if (pedido.equipe.qualificacao === false) alertas.push("qualificacao_incompativel");
  if (pedido.equipe.conflito === true) alertas.push("conflito");
  if (Object.values(pedido.equipe).some((valor) => valor === null)) alertas.push("equipe_nao_verificada");
  return {
    baselineSemana: baseline.inicio,
    origem: { semanaInicio: origem.inicio, antes: antesOrigem, depois: depoisOrigem },
    destino: { semanaInicio: destino.inicio, antes: antesDestino, depois: depoisDestino },
    alertas,
  };
}
