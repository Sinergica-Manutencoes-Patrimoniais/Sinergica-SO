import { type ColunaKanbanPreferencia, normalizarColunasKanban } from "../domain/kanban-colunas";
import type { KanbanColunasGateway } from "./kanban-colunas-gateway";

export async function obterPreferenciaColunas(
  gateway: KanbanColunasGateway,
  userId: string,
): Promise<ColunaKanbanPreferencia[]> {
  const salvas = await gateway.obterPreferencia(userId);
  return normalizarColunasKanban(salvas);
}

export async function salvarPreferenciaColunas(
  gateway: KanbanColunasGateway,
  userId: string,
  colunas: ColunaKanbanPreferencia[],
): Promise<void> {
  await gateway.salvarPreferencia(userId, colunas);
}
