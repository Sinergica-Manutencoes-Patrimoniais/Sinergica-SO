import type { EquipamentoItem } from "../domain/equipamentos";

/** Uma OS vinculada a um ativo (via `pcm.os_equipamentos_auvo` por `auvo_equipment_id`). */
export interface OsHistoricoItem {
  osId: string;
  numero: string;
  categoria: string | null;
  status: string | null;
  /** data agendada da OS (ou `created_at` quando não há agenda), ISO. */
  data: string | null;
}

export interface BoardAtivosGateway {
  /** Itens ativos de um cliente, com `localId`/`tipo`/`urlImagem` — insumo do board. */
  listarItensDoCliente(clienteId: string): Promise<EquipamentoItem[]>;
  /** Histórico de OS do ativo, mais recente primeiro. Vazio = ativo sem OS (não é erro). */
  listarHistoricoOsItem(itemId: string): Promise<OsHistoricoItem[]>;
}
