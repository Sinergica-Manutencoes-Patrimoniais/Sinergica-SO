import { montarRelatorioCliente } from "../domain/relatorio-cliente";
import type { AtividadeRelatorioCliente } from "../domain/relatorio-cliente";
import type { AgendaTecnicoGateway } from "./agenda-tecnico-gateway";
import type { HubOsGateway } from "./hub-os-gateway";
import type { PmocGateway } from "./pmoc-gateway";
import type { QualidadeGateway } from "./qualidade-gateway";

function adicionarDias(iso: string, dias: number): string {
  const data = new Date(`${iso}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** E01-S135 T2: a leitura do relatório já restringe as OS ao cliente no servidor. O domínio só
 * transforma o conjunto permitido em passado e cronograma, sem acesso ao Supabase. */
export async function obterRelatorioCliente(
  gateway: HubOsGateway,
  agendaGateway: AgendaTecnicoGateway,
  pmocGateway: PmocGateway,
  qualidadeGateway: QualidadeGateway,
  cliente: { id: string; nome: string },
  periodo: { inicio: string; fim: string },
) {
  const inicioFuturo = adicionarDias(periodo.fim, 1);
  const fimFuturo = adicionarDias(periodo.fim, 365);
  const [ordens, agenda, preventivas, inspecoes] = await Promise.all([
    gateway.listarOrdensServico({ clienteId: cliente.id }),
    agendaGateway.listarSemana(inicioFuturo, fimFuturo),
    pmocGateway.listarProximasPreventivas(),
    qualidadeGateway.listarInspecoes(),
  ]);
  const atividades: AtividadeRelatorioCliente[] = inspecoes
    .filter(
      (inspecao) =>
        inspecao.clientId === cliente.id &&
        inspecao.dataInspecao >= periodo.inicio &&
        inspecao.dataInspecao <= periodo.fim,
    )
    .map((inspecao) => ({
      numero: `INS-${inspecao.codigo ?? inspecao.id.slice(0, 8)}`,
      titulo: `Inspeção: ${inspecao.titulo}`,
      descricao: inspecao.observacoesGerais,
      data: inspecao.dataInspecao,
      evidenciaUrl: null,
    }));
  const cronograma: AtividadeRelatorioCliente[] = [
    ...preventivas
      .filter(
        (preventiva) =>
          preventiva.clienteId === cliente.id && preventiva.scheduledDate >= inicioFuturo,
      )
      .map((preventiva) => ({
        numero: `PMOC-${preventiva.id}`,
        titulo: `Preventiva PMOC: ${preventiva.maintenanceType}`,
        descricao: preventiva.imovelNome,
        data: preventiva.scheduledDate,
        evidenciaUrl: null,
      })),
    ...agenda
      .filter((alocacao) => alocacao.clienteId === cliente.id)
      .map((alocacao) => ({
        numero: `AGENDA-${alocacao.id}`,
        titulo: "Visita técnica programada",
        descricao: alocacao.funcionarioNome,
        data: alocacao.data,
        evidenciaUrl: null,
      })),
  ];
  return montarRelatorioCliente(cliente, periodo.inicio, periodo.fim, ordens, {
    atividades,
    cronograma,
  });
}
