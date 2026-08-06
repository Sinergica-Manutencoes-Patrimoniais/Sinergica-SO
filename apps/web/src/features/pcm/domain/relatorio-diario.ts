import type { ApontamentoHorasItem } from "./apontamento-horas";
import { diaLocal } from "./apontamento-horas";
import type { Chamado } from "./chamados";
import { type OrdemServicoOperacional, ehItemBacklog } from "./ordens-servico";

export interface SaudeSyncRelatorioDiario {
  entity: string;
  errorCount: number;
  pendingCount: number;
}

export interface TecnicoRelatorioDiario {
  nome: string;
  horas: number;
  ordens: number;
  auvoTaskIds: number[];
}

export interface ResumoRelatorioDiario {
  dia: string;
  ordensAbertas: number;
  ordensFinalizadas: number;
  chamadosNovos: number;
  horasApontadas: number;
  itensBacklog: number;
  emergenciais: number;
  percentualPlanejadoExecutado: number | null;
  porTecnico: TecnicoRelatorioDiario[];
  ordensAtrasadas: number;
  ordensSemTecnico: number;
  chamadosSemTratativa: number;
  errosSyncAuvo: number | null;
  pendenciasSyncAuvo: number | null;
  semMovimento: boolean;
}

export interface DadosRelatorioDiario {
  ordens: readonly OrdemServicoOperacional[];
  chamados: readonly Chamado[];
  apontamentos: readonly ApontamentoHorasItem[];
  saudeSync?: readonly SaudeSyncRelatorioDiario[] | null;
}

function diaDe(data: string | null): string | null {
  return diaLocal(data);
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** E01-S134 AC-1/AC-2: consolida um dia no fuso local do PCM. Não infere eventos que a base não
 * registra: abertura vem de `createdAt`, finalização de `checkOutAt` e horas do apontamento. */
export function montarResumoRelatorioDiario(
  dia: string,
  dados: DadosRelatorioDiario,
): ResumoRelatorioDiario {
  const ordensAbertas = dados.ordens.filter((ordem) => diaDe(ordem.createdAt) === dia);
  const ordensFinalizadas = dados.ordens.filter((ordem) => diaDe(ordem.checkOutAt) === dia);
  const chamadosNovos = dados.chamados.filter((chamado) => diaDe(chamado.createdAt) === dia);
  const apontamentos = dados.apontamentos.filter(
    (item) => diaDe(item.checkInAt) === dia || diaDe(item.checkOutAt) === dia,
  );
  const porTecnico = new Map<string, TecnicoRelatorioDiario>();
  for (const item of apontamentos) {
    const chave = item.tecnicoFuncionarioId ?? "sem-tecnico";
    const atual = porTecnico.get(chave) ?? {
      nome: item.tecnicoNome || "Sem técnico",
      horas: 0,
      ordens: 0,
      auvoTaskIds: [],
    };
    atual.horas += item.horas;
    atual.ordens += 1;
    const ordem = dados.ordens.find((candidata) => candidata.id === item.osId);
    if (ordem?.auvoTaskId != null) atual.auvoTaskIds.push(ordem.auvoTaskId);
    porTecnico.set(chave, atual);
  }
  const planejadas = dados.ordens.filter((ordem) => ordem.dataAgendada === dia);
  const executadasPlanejadas = planejadas.filter((ordem) => diaDe(ordem.checkOutAt) === dia);
  const hojeOuAntes = dados.ordens.filter(
    (ordem) =>
      ordem.dataAgendada !== null && ordem.dataAgendada < dia && ordem.status !== "finalizado",
  );
  const abertasSemTecnico = dados.ordens.filter(
    (ordem) =>
      ordem.status !== "finalizado" && ordem.status !== "cancelado" && !ordem.tecnicoFuncionarioId,
  );
  const chamadosSemTratativa = dados.chamados.filter((chamado) => chamado.status === "aberto");
  const saude = dados.saudeSync;
  const errosSyncAuvo = saude ? saude.reduce((total, item) => total + item.errorCount, 0) : null;
  const pendenciasSyncAuvo = saude
    ? saude.reduce((total, item) => total + item.pendingCount, 0)
    : null;
  const horasApontadas = arredondar(apontamentos.reduce((total, item) => total + item.horas, 0));
  const resumo: ResumoRelatorioDiario = {
    dia,
    ordensAbertas: ordensAbertas.length,
    ordensFinalizadas: ordensFinalizadas.length,
    chamadosNovos: chamadosNovos.length,
    horasApontadas,
    itensBacklog: dados.ordens.filter(ehItemBacklog).length,
    emergenciais: ordensAbertas.filter((ordem) => ordem.tipoOs === "C1").length,
    percentualPlanejadoExecutado:
      planejadas.length === 0
        ? null
        : Math.round((executadasPlanejadas.length / planejadas.length) * 100),
    porTecnico: [...porTecnico.values()]
      .map((item) => ({
        ...item,
        horas: arredondar(item.horas),
        auvoTaskIds: [...new Set(item.auvoTaskIds)],
      }))
      .sort((a, b) => b.horas - a.horas || a.nome.localeCompare(b.nome)),
    ordensAtrasadas: hojeOuAntes.length,
    ordensSemTecnico: abertasSemTecnico.length,
    chamadosSemTratativa: chamadosSemTratativa.length,
    errosSyncAuvo,
    pendenciasSyncAuvo,
    semMovimento:
      ordensAbertas.length === 0 &&
      ordensFinalizadas.length === 0 &&
      chamadosNovos.length === 0 &&
      apontamentos.length === 0,
  };
  return resumo;
}

export function formatarTextoRelatorioDiario(resumo: ResumoRelatorioDiario): string {
  const linhas = [
    `RELATÓRIO DO DIA — ${resumo.dia}`,
    `OS abertas: ${resumo.ordensAbertas} | finalizadas: ${resumo.ordensFinalizadas}`,
    `Chamados novos: ${resumo.chamadosNovos} | horas apontadas: ${resumo.horasApontadas}h`,
    `Backlog atual: ${resumo.itensBacklog} | emergenciais C1 abertas: ${resumo.emergenciais}`,
    `Planejado x executado: ${resumo.percentualPlanejadoExecutado == null ? "Sem OS planejada" : `${resumo.percentualPlanejadoExecutado}%`}`,
    "",
    "POR TÉCNICO",
    ...(resumo.porTecnico.length
      ? resumo.porTecnico.map((item) => `- ${item.nome}: ${item.horas}h, ${item.ordens} OS`)
      : ["- Sem apontamentos no dia"]),
    "",
    "ATENÇÃO",
    `- OS atrasadas: ${resumo.ordensAtrasadas}; sem técnico: ${resumo.ordensSemTecnico}; chamados sem tratativa: ${resumo.chamadosSemTratativa}`,
    `- Sync Auvo: ${resumo.errosSyncAuvo == null ? "indisponível" : `${resumo.errosSyncAuvo} erro(s), ${resumo.pendenciasSyncAuvo ?? 0} pendência(s)`}`,
  ];
  return linhas.join("\n");
}
