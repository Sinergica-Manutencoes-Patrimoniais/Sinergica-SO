import type { InspecaoResumo } from "../application/qualidade-gateway";
import type { OrdemServicoOperacional } from "./ordens-servico";
import { filtrarBacklogGut } from "./ordens-servico";

export interface KpiDashboardPcm {
  label: string;
  valor: string;
  sub: string;
  trend: "up" | "down" | "neutro";
}

export interface DashboardPcmResumo {
  kpis: KpiDashboardPcm[];
  ordensRecentes: OrdemServicoOperacional[];
  topBacklog: OrdemServicoOperacional[];
  auvo: DashboardPcmAuvoResumo | null;
}

export interface ClienteEquipamentosAuvo {
  auvoId: number;
  nome: string;
  total: number;
}

export interface DashboardPcmAuvoResumo {
  clientesAtivos: number;
  clientesSincronizados: number;
  clientesComEndereco: number;
  clientesComContato: number;
  tecnicosAtivos: number;
  equipesTecnicas: number;
  equipamentosAtivos: number;
  equipamentosVinculados: number;
  equipamentosSemCliente: number;
  clientesComEquipamentos: number;
  ultimaAtualizacao: string | null;
  topClientesEquipamentos: ClienteEquipamentosAuvo[];
  campo: DashboardPcmAuvoCampoResumo;
}

export interface DashboardPcmAuvoCampoResumo {
  snapshotsRecebidos: number;
  snapshotsComAnexos: number;
  checklistsRecebidos: number;
  pecasRegistradas: number;
  controlesHoras: number;
  osComEquipamentoVinculado: number;
  ultimaExecucaoCampo: string | null;
}

function inicioDoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), 1);
}

function inicioDaSemana(data: Date): Date {
  const clone = new Date(data);
  const dia = clone.getDay();
  clone.setDate(clone.getDate() - dia);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function desde(dataIso: string, limite: Date): boolean {
  const data = new Date(dataIso);
  return Number.isFinite(data.getTime()) && data >= limite;
}

export function montarDashboardPcm(
  ordens: readonly OrdemServicoOperacional[],
  inspecoes: readonly InspecaoResumo[],
  agora = new Date(),
  auvo: DashboardPcmAuvoResumo | null = null,
): DashboardPcmResumo {
  const backlog = filtrarBacklogGut(ordens);
  const abertas = backlog.length;
  const emExecucao = ordens.filter((ordem) => ordem.status === "em_execucao").length;
  const emPlanejamento = ordens.filter((ordem) => ordem.status === "planejamento").length;
  const criticas = ordens.filter((ordem) => ordem.prioridade === "critica").length;
  const preventivasAbertas = backlog.filter((ordem) => ordem.categoria === "preventiva").length;
  const comTaskAuvo = ordens.filter((ordem) => ordem.auvoTaskId !== null).length;
  const falhasAuvo = ordens.filter(
    (ordem) => ordem.auvoSyncStatus === "failed" || ordem.auvoSyncError !== null,
  ).length;
  const ordensComSinalAuvo = ordens.filter((ordem) => ordem.auvoSyncStatus !== null).length;
  const ordensSincronizadasAuvo = ordens.filter(
    (ordem) => ordem.auvoSyncStatus === "synced",
  ).length;
  const criadasHoje = ordens.filter((ordem) =>
    desde(ordem.createdAt, new Date(agora.toDateString())),
  ).length;
  const mes = inicioDoMes(agora);
  const semana = inicioDaSemana(agora);
  const inspecoesMes = inspecoes.filter((inspecao) => desde(inspecao.dataInspecao, mes)).length;
  const inspecoesSemana = inspecoes.filter((inspecao) =>
    desde(inspecao.dataInspecao, semana),
  ).length;

  return {
    kpis: [
      {
        label: "OS Abertas",
        valor: String(abertas),
        sub: `${criadasHoje} criadas hoje`,
        trend: "up",
      },
      {
        label: "Em Execução",
        valor: String(emExecucao),
        sub: `${emPlanejamento} em planejamento`,
        trend: "neutro",
      },
      {
        label: "Backlog GUT",
        valor: String(backlog.length),
        sub: `${criticas} críticas`,
        trend: criticas > 0 ? "down" : "neutro",
      },
      {
        label: "Maior Score",
        valor: String(backlog[0]?.scorePcm ?? 0),
        sub: backlog[0]?.numero ?? "sem backlog",
        trend: (backlog[0]?.scorePcm ?? 0) >= 100 ? "down" : "neutro",
      },
      {
        label: "Inspeções (mês)",
        valor: String(inspecoesMes),
        sub: `${inspecoesSemana} nesta semana`,
        trend: "neutro",
      },
      {
        label: "Preventivas abertas",
        valor: String(preventivasAbertas),
        sub: "categoria preventiva",
        trend: preventivasAbertas > 0 ? "down" : "neutro",
      },
      {
        label: "OS com Auvo",
        valor: String(comTaskAuvo),
        sub: "task vinculada",
        trend: "neutro",
      },
      {
        label: "Falhas Auvo",
        valor: String(falhasAuvo),
        sub: falhasAuvo > 0 ? "verificar sync" : "sem falhas",
        trend: falhasAuvo > 0 ? "down" : "up",
      },
      {
        label: "Clientes Auvo",
        valor: auvo ? String(auvo.clientesSincronizados) : "—",
        sub: auvo ? `${auvo.clientesAtivos} ativos no PCM` : "cache indisponível",
        trend: auvo && auvo.clientesSincronizados > 0 ? "up" : "neutro",
      },
      {
        label: "Ativos Auvo",
        valor: auvo ? String(auvo.equipamentosAtivos) : "—",
        sub: auvo ? `${auvo.equipamentosVinculados} vinculados` : "cache indisponível",
        trend: auvo && auvo.equipamentosSemCliente > 0 ? "down" : "neutro",
      },
      {
        label: "Técnicos Auvo",
        valor: auvo ? String(auvo.tecnicosAtivos) : "—",
        sub: auvo ? `${auvo.equipesTecnicas} equipes/cargos` : "cache indisponível",
        trend: auvo && auvo.tecnicosAtivos > 0 ? "up" : "neutro",
      },
      {
        label: "Sync OS",
        valor:
          ordensComSinalAuvo === 0
            ? "—"
            : `${Math.round((ordensSincronizadasAuvo / ordensComSinalAuvo) * 100)}%`,
        sub: `${ordensSincronizadasAuvo}/${ordensComSinalAuvo} com sinal`,
        trend: falhasAuvo > 0 ? "down" : ordensComSinalAuvo > 0 ? "up" : "neutro",
      },
    ],
    ordensRecentes: [...ordens].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    topBacklog: backlog.slice(0, 3),
    auvo,
  };
}
