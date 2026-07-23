import type { ColunaKanbanPreferencia } from "../domain/kanban-colunas";

export interface KanbanColunasGateway {
  /** Devolve `[]` quando o usuário nunca salvou preferência — quem chama normaliza pro padrão. */
  obterPreferencia(userId: string): Promise<ColunaKanbanPreferencia[]>;
  salvarPreferencia(userId: string, colunas: ColunaKanbanPreferencia[]): Promise<void>;
}
