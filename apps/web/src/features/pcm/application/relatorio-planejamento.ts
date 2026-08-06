import { auvoTaskDeepLink, rotuloStatusOs } from "../domain/ordens-servico";
import {
  type ItemRelatorioPlanejamento,
  unirItensPlanejamento,
} from "../domain/relatorio-planejamento";
import type { AgendaTecnicoGateway } from "./agenda-tecnico-gateway";
import type { HubOsGateway } from "./hub-os-gateway";

export interface FiltrosRelatorioPlanejamento {
  data: string;
  tecnicoId?: string;
  clienteId?: string;
}

export async function listarItensRelatorioPlanejamento(
  agendaGateway: AgendaTecnicoGateway,
  osGateway: HubOsGateway,
  filtros: FiltrosRelatorioPlanejamento,
): Promise<ItemRelatorioPlanejamento[]> {
  const [agenda, ordens] = await Promise.all([
    agendaGateway.listarSemana(filtros.data, filtros.data),
    osGateway.listarOrdensServico({
      status: "planejamento",
      tecnicoFuncionarioId: filtros.tecnicoId,
      clienteId: filtros.clienteId,
    }),
  ]);
  const agendaFiltrada = agenda.filter(
    (item) =>
      item.data === filtros.data &&
      (!filtros.tecnicoId || item.funcionarioId === filtros.tecnicoId) &&
      (!filtros.clienteId || item.clienteId === filtros.clienteId),
  );
  const ordensFiltradas = ordens.filter(
    (ordem) => ordem.dataAgendada?.slice(0, 10) === filtros.data,
  );
  const base = unirItensPlanejamento(
    agendaFiltrada.map((item) => ({
      id: item.id,
      clienteId: item.clienteId,
      clienteNome: item.clienteNome,
      tecnicoId: item.funcionarioId,
      tecnicoNome: item.funcionarioNome,
      data: item.data,
      horaInicio: item.horaInicio,
    })),
    ordensFiltradas.map((ordem) => ({
      id: ordem.id,
      clienteId: null,
      clienteNome: ordem.clienteNome,
      tecnicoId: ordem.tecnicoFuncionarioId,
      tecnicoNome: ordem.tecnicoNome,
      data: ordem.dataAgendada?.slice(0, 10) ?? null,
      localDescricao: ordem.localDescricao,
      titulo: ordem.titulo,
      prioridade: ordem.prioridade,
      createdAt: ordem.createdAt,
    })),
  );
  const porId = new Map(ordensFiltradas.map((ordem) => [`os:${ordem.id}`, ordem]));
  return base.map((item) => {
    const ordem = porId.get(item.id);
    return ordem
      ? {
          ...item,
          statusExecucao: rotuloStatusOs(ordem.status),
          evidênciaAuvoUrl: auvoTaskDeepLink(ordem.auvoTaskId),
        }
      : item;
  });
}
