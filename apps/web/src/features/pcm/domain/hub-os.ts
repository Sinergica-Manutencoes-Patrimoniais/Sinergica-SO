// domain/hub-os.ts — E01-S07. Hub de OS: classifica o tipo (C1/C2/P1/P2/IN) e calcula SLA/prioridade
// sobre `pcm.ordens_servico` (ADR-0010: estende a fila existente, não cria tabela nova).
// `tipoOs` é gravado (inferido na criação, editável depois); a PRIORIDADE nunca é gravada — é
// sempre recalculada aqui, pra nunca ficar desatualizada quando uma P1 atrasa.

import type { CategoriaOs } from "./abertura-os";

export type TipoOsHub = "C1" | "C2" | "P1" | "P2" | "IN";

export const TIPO_OS_HUB_LABEL: Record<TipoOsHub, string> = {
  C1: "Emergencial",
  C2: "Corretiva programada",
  P1: "Preventiva PMOC",
  P2: "Preventiva predial",
  IN: "Inspeção / follow-up",
};

/** AC-1: mapeamento determinístico categoria→tipo do Hub. `melhoria`/`outro` ficam fora do Hub
 * (não são fila urgente) — `null`. Só roda na criação (application layer nunca reinfere depois de
 * uma edição manual, AC-4). */
export function inferirTipoOsHub(
  categoria: CategoriaOs | string,
  pmocScheduleId: string | null,
): TipoOsHub | null {
  if (categoria === "emergencial") return "C1";
  if (categoria === "corretiva") return "C2";
  if (categoria === "preventiva") return pmocScheduleId ? "P1" : "P2";
  if (categoria === "inspecao") return "IN";
  return null;
}

/** AC-2: prioridade da fila do Hub — SEMPRE calculada, nunca lida de coluna. P1 atrasada (risco
 * legal, dado PMOC) sobe de 3 pra 2, equivalente a corretiva programada. Sem `tipoOs` = fora do Hub. */
export function calcularPrioridadeHub(
  tipoOs: TipoOsHub | null,
  dataAgendada: string | null,
  hoje = new Date(),
): number | null {
  if (!tipoOs) return null;
  if (tipoOs === "C1") return 1;
  if (tipoOs === "C2") return 2;
  if (tipoOs === "P1") return estaAtrasada(dataAgendada, hoje) ? 2 : 3;
  if (tipoOs === "P2") return 3;
  return 4; // IN
}

/** Verdadeiro só quando há data e ela já passou — sem data nunca conta como atrasada (borda). */
function estaAtrasada(dataAgendada: string | null, hoje: Date): boolean {
  if (!dataAgendada) return false;
  const data = new Date(dataAgendada);
  return !Number.isNaN(data.getTime()) && data.getTime() < hoje.getTime();
}

export interface PrazoSlaOs {
  /** prazo-limite, ISO, quando calculável; `null` = sem prazo fixo definido (ex.: IN sem agenda). */
  deadline: string | null;
  descricao: string;
}

/** AC-3: SLA por tipo. C1/C2 contam do created_at; P1/P2 são janela em torno de data_agendada
 * (±3d/±7d); IN não tem prazo fixo (usa data_agendada quando houver, senão indefinido). */
export function calcularPrazoSlaOs(
  tipoOs: TipoOsHub | null,
  createdAt: string,
  dataAgendada: string | null,
): PrazoSlaOs {
  if (tipoOs === "C1") return { deadline: somarHoras(createdAt, 4), descricao: "4h" };
  if (tipoOs === "C2") return { deadline: somarHoras(createdAt, 72), descricao: "72h" };
  if (tipoOs === "P1") {
    return dataAgendada
      ? { deadline: somarDias(dataAgendada, 3), descricao: "janela ±3 dias" }
      : { deadline: null, descricao: "janela ±3 dias (sem data agendada)" };
  }
  if (tipoOs === "P2") {
    return dataAgendada
      ? { deadline: somarDias(dataAgendada, 7), descricao: "janela ±7 dias" }
      : { deadline: null, descricao: "janela ±7 dias (sem data agendada)" };
  }
  if (tipoOs === "IN") {
    return dataAgendada
      ? { deadline: dataAgendada, descricao: "prazo acordado" }
      : { deadline: null, descricao: "prazo acordado (indefinido)" };
  }
  return { deadline: null, descricao: "fora do Hub" };
}

function somarHoras(iso: string, horas: number): string | null {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  return new Date(data.getTime() + horas * 3_600_000).toISOString();
}

function somarDias(iso: string, dias: number): string | null {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  return new Date(data.getTime() + dias * 86_400_000).toISOString();
}
