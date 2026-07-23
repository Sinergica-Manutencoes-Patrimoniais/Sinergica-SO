import type { EquipamentoItem } from "../domain/equipamentos";
import type { Area, Local } from "../domain/hierarquia";
import type { BoardAtivosGateway, OsHistoricoItem } from "./board-ativos-gateway";
import type { EquipamentosGateway } from "./equipamentos-gateway";
import type { HierarquiaGateway } from "./hierarquia-gateway";

export interface DadosBoard {
  areas: Area[];
  locais: Local[];
  itens: EquipamentoItem[];
}

/** AC-1: carrega tudo que o board precisa de um cliente numa tacada (áreas + locais + itens). */
export async function carregarBoardCliente(
  hierarquia: HierarquiaGateway,
  board: BoardAtivosGateway,
  clienteId: string,
): Promise<DadosBoard> {
  const [areas, locais, itens] = await Promise.all([
    hierarquia.listarAreas(clienteId),
    hierarquia.listarLocaisDoCliente(clienteId),
    board.listarItensDoCliente(clienteId),
  ]);
  return { areas, locais, itens };
}

export interface DetalheAtivo {
  contexto: Awaited<ReturnType<EquipamentosGateway["obterContextoItem"]>>;
  /** `null` = falha ao carregar o histórico (AC-6: degrada só a seção); `[]` = ativo sem OS. */
  historicoOs: OsHistoricoItem[] | null;
}

/** AC-5/AC-6: detalhe do ativo = contexto de E01-S76 (breadcrumb/sistemas/componentes) +
 * histórico de OS. O histórico isola a própria falha para não derrubar o resto do drawer. */
export async function obterDetalheAtivo(
  equipamentos: EquipamentosGateway,
  board: BoardAtivosGateway,
  itemId: string,
): Promise<DetalheAtivo> {
  const [contexto, historicoOs] = await Promise.all([
    equipamentos.obterContextoItem(itemId),
    board.listarHistoricoOsItem(itemId).catch(() => null),
  ]);
  return { contexto, historicoOs };
}
