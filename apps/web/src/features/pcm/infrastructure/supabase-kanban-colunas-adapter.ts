import { supabase } from "../../../lib/supabase-client";
import type { KanbanColunasGateway } from "../application/kanban-colunas-gateway";
import type { ColunaKanbanPreferencia } from "../domain/kanban-colunas";

export const supabaseKanbanColunasAdapter: KanbanColunasGateway = {
  async obterPreferencia(userId: string): Promise<ColunaKanbanPreferencia[]> {
    const { data, error } = await supabase
      .schema("config")
      .from("preferencia_colunas_kanban_os")
      .select("colunas")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data?.colunas as ColunaKanbanPreferencia[] | undefined) ?? [];
  },

  async salvarPreferencia(userId: string, colunas: ColunaKanbanPreferencia[]): Promise<void> {
    const { error } = await supabase
      .schema("config")
      .from("preferencia_colunas_kanban_os")
      .upsert({ user_id: userId, colunas, updated_at: new Date().toISOString() });
    if (error) throw error;
  },
};
