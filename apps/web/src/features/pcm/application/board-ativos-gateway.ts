import type { EquipamentoItem } from "../domain/equipamentos";
import type { OsHistoricoItem } from "../domain/historico-ativo";

export type { OsHistoricoItem } from "../domain/historico-ativo";

export interface BoardAtivosGateway {
  /** Itens ativos de um cliente, com `localId`/`tipo`/`urlImagem` — insumo do board. */
  listarItensDoCliente(clienteId: string): Promise<EquipamentoItem[]>;
  /** Histórico de OS do ativo, mais recente primeiro. Vazio = ativo sem OS (não é erro). */
  listarHistoricoOsItem(itemId: string): Promise<OsHistoricoItem[]>;
}
