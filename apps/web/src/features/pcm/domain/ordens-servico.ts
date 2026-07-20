import { STATUS_HISTORICO } from "./cliente-360";
import type { TipoOsHub } from "./hub-os";

export type StatusOrdemServico =
  | "solicitacao"
  | "corretiva"
  | "planejamento"
  | "em_execucao"
  | "finalizado"
  | "cancelado";

export type PrioridadeOrdemServico = "baixa" | "normal" | "media" | "alta" | "critica";

export interface OrdemServicoOperacional {
  id: string;
  numero: string;
  titulo: string;
  descricao: string | null;
  clienteNome: string;
  categoria: string;
  status: string;
  prioridade: PrioridadeOrdemServico | string;
  scorePcm: number;
  gravidade: number | null;
  urgencia: number | null;
  tendencia: number | null;
  auvoTaskId: number | null;
  auvoSyncStatus: string | null;
  auvoSyncError: string | null;
  createdAt: string;
  /** E01-S38: dado rico da tarefa Auvo (Kanban/timeline/calendário) — null em OS manual. */
  tecnicoFuncionarioId: string | null;
  tecnicoNome: string | null;
  dataAgendada: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  detalhes: Record<string, unknown> | null;
  /** E01-S07: tipo do Hub (C1/C2/P1/P2/IN), gravado — `null` = fora do Hub (melhoria/outro). */
  tipoOs: TipoOsHub | null;
  pmocScheduleId: string | null;
}

export interface KpisOrdensServico {
  total: number;
  abertas: number;
  emPlanejamento: number;
  emExecucao: number;
  finalizadas: number;
  criticas: number;
}

export const STATUS_OS: Array<{ value: StatusOrdemServico; label: string }> = [
  { value: "solicitacao", label: "Solicitação" },
  { value: "corretiva", label: "Corretiva" },
  { value: "planejamento", label: "Planejamento" },
  { value: "em_execucao", label: "Em execução" },
  { value: "finalizado", label: "Finalizado" },
  { value: "cancelado", label: "Cancelado" },
];

export const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: "Baixa",
  normal: "Normal",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export function rotuloStatusOs(status: string): string {
  return STATUS_OS.find((item) => item.value === status)?.label ?? status;
}

export function statusOsColor(status: string): string {
  if (status === "finalizado") return "bg-[#E7F6EC] text-[#1E8E45]";
  if (status === "cancelado") return "bg-[#FBEAEA] text-[#C5362B]";
  if (status === "em_execucao") return "bg-[#EAEEF8] text-[#2E3C70]";
  if (status === "planejamento") return "bg-[#FDF1DF] text-[#B26A00]";
  return "bg-[#EFF1F4] text-[#5A6175]";
}

export function prioridadeColor(prioridade: string): string {
  if (prioridade === "critica") return "bg-[#FCE9E7] text-[#C5362B]";
  if (prioridade === "alta") return "bg-[#FDF1DF] text-[#B26A00]";
  if (prioridade === "media" || prioridade === "normal") return "bg-[#FFF7E6] text-[#8A5A00]";
  return "bg-[#EFF1F4] text-[#5A6175]";
}

export function ehOsHistorica(status: string): boolean {
  return (STATUS_HISTORICO as readonly string[]).includes(status);
}

export function ehOsAberta(status: string): boolean {
  return !ehOsHistorica(status);
}

/** E01-S61 — AC-4: soltar o card na própria coluna de origem não deve disparar alteração de
 * status (evita PATCH/evento vazio no outbox Auvo). */
export function deveAlterarStatusPorDrop(statusOrigem: string, statusDestino: string): boolean {
  return statusOrigem !== statusDestino;
}

export function ordenarBacklogGut<T extends { scorePcm: number; createdAt: string }>(
  ordens: readonly T[],
): T[] {
  return [...ordens].sort(
    (a, b) => b.scorePcm - a.scorePcm || b.createdAt.localeCompare(a.createdAt),
  );
}

export function filtrarBacklogGut<
  T extends { status: string; scorePcm: number; createdAt: string },
>(ordens: readonly T[]): T[] {
  return ordenarBacklogGut(ordens.filter((ordem) => ehOsAberta(ordem.status)));
}

export interface GrupoTecnico {
  tecnicoId: string | null;
  tecnicoNome: string;
  ordens: OrdemServicoOperacional[];
}

/** E01-S38: agrupa por técnico pra timeline — "Sem técnico" sempre por último, os demais em
 * ordem alfabética. OS sem `tecnicoFuncionarioId` (não resolvido ou OS manual) cai no grupo
 * "Sem técnico". */
export function agruparPorTecnico(ordens: readonly OrdemServicoOperacional[]): GrupoTecnico[] {
  const grupos = new Map<string, GrupoTecnico>();
  for (const ordem of ordens) {
    const chave = ordem.tecnicoFuncionarioId ?? "__sem_tecnico__";
    const nome = ordem.tecnicoFuncionarioId ? (ordem.tecnicoNome ?? "Técnico") : "Sem técnico";
    if (!grupos.has(chave))
      grupos.set(chave, { tecnicoId: ordem.tecnicoFuncionarioId, tecnicoNome: nome, ordens: [] });
    grupos.get(chave)?.ordens.push(ordem);
  }
  return [...grupos.values()].sort((a, b) => {
    if (a.tecnicoId == null) return 1;
    if (b.tecnicoId == null) return -1;
    return a.tecnicoNome.localeCompare(b.tecnicoNome);
  });
}

function paraDiaIso(dataIso: string | null): string | null {
  if (!dataIso) return null;
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return null;
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

/** E01-S38: OS cuja `dataAgendada` cai no dia informado (`YYYY-MM-DD`, fuso local do navegador —
 * calendário é uma visão de agenda, não precisa de UTC estrito). */
export function ordensNoDia(
  ordens: readonly OrdemServicoOperacional[],
  diaIso: string,
): OrdemServicoOperacional[] {
  return ordens.filter((ordem) => paraDiaIso(ordem.dataAgendada) === diaIso);
}

/** E01-S38: grade de 6 semanas (42 dias) pro mês do calendário, começando no domingo anterior (ou
 * igual) ao dia 1 — inclui dias de meses adjacentes pra completar as semanas. */
export function gerarDiasDoMes(ano: number, mes: number): Date[] {
  const primeiroDia = new Date(ano, mes, 1);
  const inicio = new Date(primeiroDia);
  inicio.setDate(inicio.getDate() - primeiroDia.getDay());
  return Array.from({ length: 42 }, (_, indice) => {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + indice);
    return dia;
  });
}

export function formatarDiaIso(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

/** E01-S41: texto compacto pro tooltip de hover — descrição + os campos de `detalhes` mais úteis
 * pra reconhecer a tarefa sem abrir o painel. `null` quando não há nada pra mostrar (tooltip não
 * aparece nesse caso). */
export function resumoTooltipOrdem(ordem: OrdemServicoOperacional): string | null {
  const detalhes = ordem.detalhes ?? {};
  const texto = (chave: string) =>
    typeof detalhes[chave] === "string" ? (detalhes[chave] as string) : null;
  const tecnico = ordem.tecnicoNome ?? texto("tecnicoNomeAuvo") ?? "não atribuído";
  const linhas = [
    `${ordem.numero} · ${rotuloStatusOs(ordem.status)} · ${PRIORIDADE_LABEL[ordem.prioridade] ?? ordem.prioridade}`,
    `Cliente: ${ordem.clienteNome}`,
    `Categoria: ${ordem.categoria} · Técnico: ${tecnico}`,
    ordem.descricao?.trim() || null,
    texto("address") ? `Endereço: ${texto("address")}` : null,
    texto("orientacao") ? `Orientação: ${texto("orientacao")}` : null,
    texto("relato") ? `Relato: ${texto("relato")}` : null,
  ].filter((linha): linha is string => Boolean(linha));
  return linhas.join("\n");
}

export interface FiltrosOrdens {
  busca: string;
  status: string;
  tecnicoFuncionarioId: string;
  categoria: string;
  dataInicio: string | null;
  dataFim: string | null;
}

export const FILTROS_ORDENS_VAZIO: FiltrosOrdens = {
  busca: "",
  status: "todas",
  tecnicoFuncionarioId: "todos",
  categoria: "todas",
  dataInicio: null,
  dataFim: null,
};

/** E01-S42: combina busca/status/técnico/categoria/intervalo de data (E lógico entre todos os
 * filtros preenchidos). Pura pra ser testável sem montar a página. */
export function filtrarOrdens(
  ordens: readonly OrdemServicoOperacional[],
  filtros: FiltrosOrdens,
): OrdemServicoOperacional[] {
  const termo = filtros.busca.trim().toLowerCase();
  return ordens.filter((ordem) => {
    const passaBusca =
      termo.length === 0 ||
      ordem.numero.toLowerCase().includes(termo) ||
      ordem.titulo.toLowerCase().includes(termo) ||
      ordem.clienteNome.toLowerCase().includes(termo);
    const passaStatus = filtros.status === "todas" || ordem.status === filtros.status;
    const passaTecnico =
      filtros.tecnicoFuncionarioId === "todos" ||
      ordem.tecnicoFuncionarioId === filtros.tecnicoFuncionarioId;
    const passaCategoria = filtros.categoria === "todas" || ordem.categoria === filtros.categoria;
    const dataOrdem = ordem.createdAt.slice(0, 10);
    const passaDataInicio = !filtros.dataInicio || dataOrdem >= filtros.dataInicio;
    const passaDataFim = !filtros.dataFim || dataOrdem <= filtros.dataFim;
    return (
      passaBusca && passaStatus && passaTecnico && passaCategoria && passaDataInicio && passaDataFim
    );
  });
}

export function calcularKpisOrdens(ordens: readonly OrdemServicoOperacional[]): KpisOrdensServico {
  return ordens.reduce<KpisOrdensServico>(
    (kpis, ordem) => ({
      total: kpis.total + 1,
      abertas: kpis.abertas + (ehOsAberta(ordem.status) ? 1 : 0),
      emPlanejamento: kpis.emPlanejamento + (ordem.status === "planejamento" ? 1 : 0),
      emExecucao: kpis.emExecucao + (ordem.status === "em_execucao" ? 1 : 0),
      finalizadas: kpis.finalizadas + (ordem.status === "finalizado" ? 1 : 0),
      criticas: kpis.criticas + (ordem.prioridade === "critica" ? 1 : 0),
    }),
    { total: 0, abertas: 0, emPlanejamento: 0, emExecucao: 0, finalizadas: 0, criticas: 0 },
  );
}
