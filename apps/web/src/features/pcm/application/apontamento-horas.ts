import {
  type DiaTecnico,
  type FiltrosApontamentoHoras,
  agregarPorCliente,
  agregarPorSemana,
  agregarPorTecnico,
  agruparPorDia,
  filtrarApontamentos,
  sinalizarJornada,
} from "../domain/apontamento-horas";
import type { ApontamentoHorasGateway } from "./apontamento-horas-gateway";

export async function obterApontamentoHoras(
  gateway: ApontamentoHorasGateway,
  filtros: FiltrosApontamentoHoras,
) {
  const [itensBrutos, clientes, tecnicos] = await Promise.all([
    gateway.listarApontamentos(filtros.inicio, filtros.fim),
    gateway.listarClientes(),
    gateway.listarTecnicos(),
  ]);
  const itens = filtrarApontamentos(itensBrutos, filtros);
  const jornadaPorTecnico = new Map(tecnicos.map((t) => [t.id, t.jornadaDiariaHoras] as const));
  return {
    itens,
    clientes,
    tecnicos,
    porCliente: agregarPorCliente(itens),
    porTecnico: agregarPorTecnico(itens),
    porDia: enriquecerComJornada(agruparPorDia(itens), jornadaPorTecnico),
  };
}

/** AC-6: aplica a jornada esperada do técnico ao span de cada dia. Dia incompleto (AC-5) nunca é
 * sinalizado como falta/hora-extra — o span não é confiável, o badge de "incompleto" já cobre. */
function enriquecerComJornada(
  dias: DiaTecnico[],
  jornadaPorTecnico: Map<string, number | null>,
): DiaTecnico[] {
  return dias.map((dia) => {
    if (dia.incompleto) return { ...dia, sinalJornada: null };
    const jornada = dia.tecnicoFuncionarioId
      ? jornadaPorTecnico.get(dia.tecnicoFuncionarioId)
      : null;
    return { ...dia, sinalJornada: sinalizarJornada(dia.diferencaDiaHoras, jornada) };
  });
}

/** AC-8: tendência semanal de um técnico numa janela mais larga que o filtro pontual da aba. */
export async function obterTendenciaTecnico(
  gateway: ApontamentoHorasGateway,
  tecnicoFuncionarioId: string,
  semanas = 8,
) {
  const fim = new Date();
  const inicio = new Date(fim);
  inicio.setDate(inicio.getDate() - semanas * 7);
  const inicioIso = inicio.toISOString().slice(0, 10);
  const fimIso = fim.toISOString().slice(0, 10);
  const itensBrutos = await gateway.listarApontamentos(inicioIso, fimIso);
  const itens = filtrarApontamentos(itensBrutos, {
    inicio: inicioIso,
    fim: fimIso,
    tecnicoFuncionarioId,
  });
  return agregarPorSemana(itens);
}

export function buscarValorHoraTecnico(
  gateway: ApontamentoHorasGateway,
  tecnicoFuncionarioId: string,
) {
  return gateway.buscarValorHora(tecnicoFuncionarioId);
}
