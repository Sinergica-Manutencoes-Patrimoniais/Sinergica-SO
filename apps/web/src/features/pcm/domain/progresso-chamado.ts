import { STATUS_OS } from "./ordens-servico";

export type ResumoChamadoCard = { total: number; finalizadas: number; etapasMistas: boolean };

/** Somente para lista integral e autorizada; não prova encerramento do Chamado. */
export function resumirProgressoChamado(
  status: readonly string[],
  listaCompleta: boolean,
): {
  total: number;
  finalizadas: number;
  etapasMistas: boolean;
} | null {
  if (!listaCompleta || status.length === 0) return null;
  const conhecidos = new Set<string>(STATUS_OS.map((item) => item.value));
  return {
    total: status.length,
    finalizadas: status.filter((item) => item === "finalizado").length,
    etapasMistas: status.every((item) => conhecidos.has(item)) && new Set(status).size > 1,
  };
}
