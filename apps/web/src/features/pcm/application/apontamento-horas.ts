import {
  type FiltrosApontamentoHoras,
  agregarPorCliente,
  agregarPorTecnico,
  filtrarApontamentos,
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
  return {
    itens,
    clientes,
    tecnicos,
    porCliente: agregarPorCliente(itens),
    porTecnico: agregarPorTecnico(itens),
  };
}

export function buscarValorHoraTecnico(
  gateway: ApontamentoHorasGateway,
  tecnicoFuncionarioId: string,
) {
  return gateway.buscarValorHora(tecnicoFuncionarioId);
}
