import type { InspecaoResumo } from "../application/qualidade-gateway";
import type { AlocacaoTecnico } from "./agenda-tecnico";
import type { Chamado } from "./chamados";
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
  cockpit?: CockpitBomDia;
}

export interface CockpitBomDia {
  dia: string;
  osHoje: OrdemServicoOperacional[];
  alocacoes: Array<{ tecnicoNome: string; clienteNome: string; local: string }>;
  tecnicosLivres: string[];
  chamadosSemTratativa: number;
  emergenciaisAbertas: number;
  osAtrasadas: number;
  capacidadeDemanda: { tecnicos: number; os: number };
  topBacklog: OrdemServicoOperacional[];
  errosSyncAuvo: number | null;
  inspecoesPendentes: number;
}

/** E01-S136 AC-1..4, S1..S8: leitura operacional de uma manhã no dia local já normalizado pelo
 * caller. Agenda e OS se complementam; a mesma pessoa aparece uma vez por destino conhecido. */
export function montarCockpitBomDia(
  dia: string,
  dados: {
    ordens: readonly OrdemServicoOperacional[];
    chamados: readonly Chamado[];
    tecnicos: readonly { id: string; nome: string }[];
    agenda: readonly AlocacaoTecnico[];
    errosSyncAuvo?: number | null;
    inspecoesPendentes?: number;
  },
): CockpitBomDia {
  const osHoje = dados.ordens.filter(
    (ordem) =>
      ordem.dataAgendada === dia && ordem.status !== "finalizado" && ordem.status !== "cancelado",
  );
  const alocacoesAgenda = dados.agenda.filter((alocacao) => alocacao.data === dia);
  const alocacoes = [
    ...alocacoesAgenda.map((alocacao) => ({
      tecnicoNome: alocacao.funcionarioNome || "Técnico",
      clienteNome: alocacao.clienteNome || "Cliente a definir",
      local: "local a definir",
    })),
    ...osHoje
      .filter((ordem) => ordem.tecnicoFuncionarioId !== null)
      .map((ordem) => ({
        tecnicoNome: ordem.tecnicoNome ?? "Técnico",
        clienteNome: ordem.clienteNome || "Cliente a definir",
        local: ordem.localDescricao || "local a definir",
      })),
  ].filter(
    (alocacao, indice, lista) =>
      lista.findIndex(
        (candidata) =>
          candidata.tecnicoNome === alocacao.tecnicoNome &&
          candidata.clienteNome === alocacao.clienteNome,
      ) === indice,
  );
  const nomesAlocados = new Set(alocacoes.map((alocacao) => alocacao.tecnicoNome));
  return {
    dia,
    osHoje,
    alocacoes,
    tecnicosLivres: dados.tecnicos
      .filter((tecnico) => !nomesAlocados.has(tecnico.nome))
      .map((tecnico) => tecnico.nome),
    chamadosSemTratativa: dados.chamados.filter((chamado) => chamado.status === "aberto").length,
    emergenciaisAbertas: dados.ordens.filter(
      (ordem) =>
        ordem.tipoOs === "C1" && ordem.status !== "finalizado" && ordem.status !== "cancelado",
    ).length,
    osAtrasadas: dados.ordens.filter(
      (ordem) =>
        ordem.dataAgendada !== null &&
        ordem.dataAgendada < dia &&
        ordem.status !== "finalizado" &&
        ordem.status !== "cancelado",
    ).length,
    capacidadeDemanda: { tecnicos: dados.tecnicos.length, os: osHoje.length },
    topBacklog: filtrarBacklogGut([...dados.ordens]).slice(0, 5),
    errosSyncAuvo: dados.errosSyncAuvo ?? null,
    inspecoesPendentes: dados.inspecoesPendentes ?? 0,
  };
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
  execucoesRegistradas: number;
  anexosRegistrados: number;
  relatosRegistrados: number;
  assinaturasRegistradas: number;
  checklistsRecebidos: number;
  pecasRegistradas: number;
  controlesHoras: number;
  osComEquipamentoVinculado: number;
  ultimaExecucaoCampo: string | null;
}

export interface CampoAuvoSnapshot {
  ordemServicoId: string | null;
  anexos: unknown;
  checklist: unknown;
  pecasConsumidas: unknown;
  controleHoras: unknown;
  checkinEm: string | null;
  concluidaEm: string | null;
  recebidoEm: string | null;
}

export interface CampoAuvoOrdem {
  id: string;
  detalhes: Record<string, unknown> | null;
  checkInAt: string | null;
  checkOutAt: string | null;
}

/** Defesa em profundidade para erros já higienizados pela view: a UI nunca deve renderizar stack
 * trace ou possível segredo caso uma migration antiga ainda esteja em uso. */
export function mensagemErroSyncAuvoLegivel(mensagem: string | null): string {
  const texto = mensagem?.trim().replace(/\s+/g, " ") ?? "";
  if (!texto) return "Falha de sincronização sem detalhe.";
  if (
    /(authorization|bearer|api[_ -]?key|token|secret|senha|password)/i.test(texto) ||
    /\bat\s+.+\(/i.test(texto)
  ) {
    return "Detalhe técnico protegido. Consulte os logs de sincronização.";
  }
  return texto.slice(0, 500);
}

function temConteudo(valor: unknown): boolean {
  if (Array.isArray(valor)) return valor.length > 0;
  if (valor && typeof valor === "object") return Object.keys(valor).length > 0;
  if (typeof valor === "string") return valor.trim().length > 0;
  return false;
}

function numeroPositivo(valor: unknown): boolean {
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(numero) && numero > 0;
}

function maiorDataIso(datas: Array<string | null | undefined>): string | null {
  return (
    datas.filter((data): data is string => Boolean(data)).sort((a, b) => b.localeCompare(a))[0] ??
    null
  );
}

/** Consolida evidências da fonte incremental (webhook) e do histórico trazido pelo pull. Os sets
 * usam o id da OS para que a mesma execução não seja contada duas vezes nas duas fontes. */
export function consolidarSinaisCampoAuvo(
  snapshots: readonly CampoAuvoSnapshot[],
  ordens: readonly CampoAuvoOrdem[],
  osComEquipamentoIds: readonly string[],
): DashboardPcmAuvoCampoResumo {
  const execucoes = new Set<string>();
  const anexos = new Set<string>();
  const checklists = new Set<string>();
  const pecas = new Set<string>();
  const horas = new Set<string>();
  const relatos = new Set<string>();
  const assinaturas = new Set<string>();
  const datas: Array<string | null> = [];

  snapshots.forEach((snapshot, indice) => {
    const chave = snapshot.ordemServicoId ?? `snapshot:${indice}`;
    execucoes.add(chave);
    if (temConteudo(snapshot.anexos)) anexos.add(chave);
    if (temConteudo(snapshot.checklist)) checklists.add(chave);
    if (temConteudo(snapshot.pecasConsumidas)) pecas.add(chave);
    if (temConteudo(snapshot.controleHoras)) horas.add(chave);
    datas.push(snapshot.concluidaEm, snapshot.checkinEm, snapshot.recebidoEm);
  });

  for (const ordem of ordens) {
    const detalhes = ordem.detalhes ?? {};
    const temAnexos = temConteudo(detalhes.anexos);
    const temRelato = temConteudo(detalhes.relato);
    const temAssinatura = temConteudo(detalhes.assinaturaUrl);
    const temPecas = temConteudo(detalhes.produtos);
    const temHoras = numeroPositivo(detalhes.duracaoHoras) || Boolean(ordem.checkOutAt);
    const temExecucao =
      Boolean(ordem.checkInAt || ordem.checkOutAt) ||
      temHoras ||
      temAnexos ||
      temRelato ||
      temAssinatura ||
      temPecas;

    if (temExecucao) execucoes.add(ordem.id);
    if (temAnexos) anexos.add(ordem.id);
    if (temRelato) relatos.add(ordem.id);
    if (temAssinatura) assinaturas.add(ordem.id);
    if (temPecas) pecas.add(ordem.id);
    if (temHoras) horas.add(ordem.id);
    datas.push(ordem.checkOutAt, ordem.checkInAt);
  }

  return {
    execucoesRegistradas: execucoes.size,
    anexosRegistrados: anexos.size,
    relatosRegistrados: relatos.size,
    assinaturasRegistradas: assinaturas.size,
    checklistsRecebidos: checklists.size,
    pecasRegistradas: pecas.size,
    controlesHoras: horas.size,
    osComEquipamentoVinculado: new Set(osComEquipamentoIds).size,
    ultimaExecucaoCampo: maiorDataIso(datas),
  };
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
