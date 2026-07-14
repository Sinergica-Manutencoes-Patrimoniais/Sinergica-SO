import type { FerramentaUnidadeItem } from "./ferramenta-unidades";

export type StatusReservaFerramenta = "pendente" | "efetivada" | "cancelada";

export interface FerramentaReservaItem {
  id: string;
  ferramentaId: string;
  ferramentaNome: string;
  unidadeId: string | null;
  unidadeCodigo: string | null;
  funcionarioId: string;
  funcionarioNome: string;
  dataInicio: string;
  dataFim: string;
  status: StatusReservaFerramenta;
  motivoCancelamento: string | null;
}

export interface CriarReservaFormData {
  ferramentaId: string;
  unidadeId?: string | null;
  funcionarioId: string;
  dataInicio: string;
  dataFim?: string | null;
}

export interface EfetivarReservaFormData {
  reservaId: string;
  unidadeId: string;
}

export interface CancelarReservaFormData {
  reservaId: string;
  motivo?: string | null;
}

function intervalosSeSobrepoem(
  aInicio: string,
  aFim: string,
  bInicio: string,
  bFim: string,
): boolean {
  return aInicio <= bFim && aFim >= bInicio;
}

/** AC-1/AC-2: reserva de unidade específica precisa não conflitar com nenhuma reserva pendente da
 * mesma unidade no intervalo pedido; reserva genérica (`unidadeId` ausente) precisa que sobre pelo
 * menos 1 unidade ativa livre no PIOR caso — aproximação conservadora: se o número de reservas já
 * sobrepondo o intervalo alcança o número de unidades ativas, não há garantia de unidade livre. */
export function validarCriarReserva(
  input: CriarReservaFormData,
  unidadesDaFerramenta: FerramentaUnidadeItem[],
  reservasPendentesDaFerramenta: FerramentaReservaItem[],
): CriarReservaFormData & { dataFim: string } {
  if (!input.ferramentaId) throw new Error("Ferramenta é obrigatória.");
  if (!input.funcionarioId) throw new Error("Técnico é obrigatório.");
  if (!input.dataInicio) throw new Error("Data de início é obrigatória.");
  const dataFim = input.dataFim?.trim() || input.dataInicio;
  if (dataFim < input.dataInicio) {
    throw new Error("Data fim não pode ser antes da data início.");
  }

  if (input.unidadeId) {
    const conflito = reservasPendentesDaFerramenta.find(
      (reserva) =>
        reserva.unidadeId === input.unidadeId &&
        intervalosSeSobrepoem(reserva.dataInicio, reserva.dataFim, input.dataInicio, dataFim),
    );
    if (conflito) {
      throw new Error(
        `Unidade já reservada por ${conflito.funcionarioNome} de ${conflito.dataInicio} a ${conflito.dataFim}.`,
      );
    }
    return { ...input, dataFim };
  }

  const unidadesAtivas = unidadesDaFerramenta.filter((unidade) => unidade.status !== "baixada");
  if (unidadesAtivas.length === 0) {
    throw new Error("Nenhuma unidade ativa desta ferramenta pra reservar.");
  }
  const reservasSobrepondo = reservasPendentesDaFerramenta.filter((reserva) =>
    intervalosSeSobrepoem(reserva.dataInicio, reserva.dataFim, input.dataInicio, dataFim),
  ).length;
  if (reservasSobrepondo >= unidadesAtivas.length) {
    throw new Error(
      "Não há unidade livre desta ferramenta nesse período — todas já reservadas ou atribuídas no pior caso.",
    );
  }
  return { ...input, dataFim };
}

export function validarEfetivarReserva(
  input: EfetivarReservaFormData,
  reserva?: FerramentaReservaItem,
  unidade?: FerramentaUnidadeItem,
): EfetivarReservaFormData {
  if (!reserva) throw new Error("Reserva não encontrada.");
  if (reserva.status !== "pendente") throw new Error("Só reserva pendente pode ser efetivada.");
  if (!input.unidadeId) throw new Error("Escolha a unidade pra efetivar.");
  if (!unidade) throw new Error("Unidade não encontrada.");
  if (unidade.status !== "disponivel") {
    throw new Error(`Unidade ${unidade.codigo} não está disponível pra efetivar a reserva.`);
  }
  return input;
}

export function validarCancelarReserva(
  input: CancelarReservaFormData,
  reserva?: FerramentaReservaItem,
): CancelarReservaFormData {
  if (!reserva) throw new Error("Reserva não encontrada.");
  if (reserva.status !== "pendente") throw new Error("Só reserva pendente pode ser cancelada.");
  return input;
}

/** AC-5: destaque de agenda — hoje/amanhã primeiro, ação rápida de efetivar. */
export function ordenarAgendaReservas(reservas: FerramentaReservaItem[]): FerramentaReservaItem[] {
  return [...reservas]
    .filter((reserva) => reserva.status === "pendente")
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
}
