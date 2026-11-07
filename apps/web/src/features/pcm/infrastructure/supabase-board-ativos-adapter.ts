import { supabase } from "../../../lib/supabase-client";
import type { BoardAtivosGateway, OsHistoricoItem } from "../application/board-ativos-gateway";
import type { EquipamentoItem, ItemTipo } from "../domain/equipamentos";
import { buscarHistoricoPorAuvoIds } from "./supabase-sistemas-adapter";

interface ItemRow {
  id: string;
  nome: string;
  identificador: string | null;
  categoria_id: string | null;
  categoria: string | null;
  client_id: string | null;
  auvo_customer_id: number | null;
  localizacao: string | null;
  observacoes: string | null;
  ativo: boolean;
  auvo_id: number | null;
  auvo_sync_status: string | null;
  auvo_sync_error: string | null;
  auvo_synced_at: string | null;
  url_imagem: string | null;
  uri_anexos: string[] | null;
  local_id: string | null;
  tipo: string;
  parent_item_id: string | null;
  area_id: string | null;
}

const ITEM_COLS =
  "id,nome,identificador,categoria_id,categoria,client_id,auvo_customer_id,localizacao,observacoes,ativo,auvo_id,auvo_sync_status,auvo_sync_error,auvo_synced_at,url_imagem,uri_anexos,local_id,tipo,parent_item_id,area_id" as const;

function mapItem(row: ItemRow): EquipamentoItem {
  return {
    id: row.id,
    nome: row.nome,
    identificador: row.identificador,
    categoriaId: row.categoria_id,
    categoria: row.categoria,
    clientId: row.client_id,
    clienteNome: null, // board é por cliente — o nome não é usado nos cards
    auvoCustomerId: row.auvo_customer_id,
    localizacao: row.localizacao,
    observacoes: row.observacoes,
    ativo: row.ativo,
    auvoId: row.auvo_id,
    auvoSyncStatus: row.auvo_sync_status,
    auvoSyncError: row.auvo_sync_error,
    auvoSyncedAt: row.auvo_synced_at,
    urlImagem: row.url_imagem,
    uriAnexos: row.uri_anexos ?? [],
    localId: row.local_id,
    tipo: (row.tipo as ItemTipo) ?? "equipamento",
    parentItemId: row.parent_item_id,
    areaId: row.area_id,
  };
}

export const supabaseBoardAtivosAdapter: BoardAtivosGateway = {
  async listarItensDoCliente(clienteId: string): Promise<EquipamentoItem[]> {
    const itens: ItemRow[] = [];
    const vistos = new Set<string>();
    let esperado: number | null = null;
    const tamanhoPagina = 500;
    const limite = 50_000;
    for (;;) {
      const { data, error, count } = await supabase.schema("pcm").from("equipamentos")
        .select(ITEM_COLS, { count: "exact" }).eq("client_id", clienteId).is("deleted_at", null)
        .order("nome", { ascending: true }).order("id", { ascending: true })
        .range(itens.length, itens.length + tamanhoPagina - 1);
      if (error) throw error;
      if (count === null || count > limite) throw new Error("Lista de ativos excede o limite de consulta.");
      if (esperado !== null && esperado !== count) throw new Error("Lista de ativos alterada durante a consulta.");
      esperado = count;
      const pagina = (data ?? []) as ItemRow[];
      for (const item of pagina) {
        const id = item.id.toLowerCase();
        if (item.client_id?.toLowerCase() !== clienteId.toLowerCase() || vistos.has(id)) throw new Error("Lista de ativos inconsistente.");
        vistos.add(id); itens.push(item);
      }
      if (itens.length > esperado || itens.length > limite) throw new Error("Lista de ativos inconsistente.");
      if (pagina.length < tamanhoPagina) break;
    }
    if (itens.length !== esperado) throw new Error("Lista de ativos alterada durante a consulta.");
    return itens.map(mapItem);
  },

  async listarHistoricoOsItem(itemId: string): Promise<OsHistoricoItem[]> {
    // 1) chave de junção com o Auvo (o vínculo OS↔ativo é por auvo_equipment_id, E01-S16).
    const { data: item, error: itemErro } = await supabase
      .schema("pcm")
      .from("equipamentos")
      .select("auvo_equipment_id,client_id")
      .eq("id", itemId)
      .maybeSingle();
    if (itemErro) throw itemErro;
    if (!item?.client_id) throw new Error("Ativo indisponível ou sem Cliente definido.");
    const auvoEquipmentId = (item?.auvo_equipment_id as number | null) ?? null;
    if (auvoEquipmentId == null) return []; // sem chave — ativo sem OS vinculável, não é erro

    // Compartilha a leitura paginada usada pelo histórico dos Sistemas.
    return buscarHistoricoPorAuvoIds([auvoEquipmentId], item.client_id as string);
  },
};
