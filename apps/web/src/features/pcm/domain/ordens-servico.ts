import { STATUS_HISTORICO } from "./cliente-360";

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
