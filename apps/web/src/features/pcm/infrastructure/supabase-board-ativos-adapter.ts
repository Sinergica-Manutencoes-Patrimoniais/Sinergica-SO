import { supabase } from "../../../lib/supabase-client";
import type { BoardAtivosGateway, OsHistoricoItem } from "../application/board-ativos-gateway";
import type { EquipamentoItem, ItemTipo } from "../domain/equipamentos";

interface ItemRow {
  id: string;
  nome: string;
  identificador: string | null;
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
}

const ITEM_COLS =
  "id,nome,identificador,categoria,client_id,auvo_customer_id,localizacao,observacoes,ativo,auvo_id,auvo_sync_status,auvo_sync_error,auvo_synced_at,url_imagem,uri_anexos,local_id,tipo,parent_item_id" as const;

function mapItem(row: ItemRow): EquipamentoItem {
  return {
    id: row.id,
    nome: row.nome,
    identificador: row.identificador,
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
  };
}

interface OsRow {
  id: string;
  numero: string;
  categoria: string | null;
  status: string | null;
  data_agendada: string | null;
  created_at: string | null;
}

export const supabaseBoardAtivosAdapter: BoardAtivosGateway = {
  async listarItensDoCliente(clienteId: string): Promise<EquipamentoItem[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("equipamentos")
      .select(ITEM_COLS)
      .eq("client_id", clienteId)
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as ItemRow[]).map(mapItem);
  },

  async listarHistoricoOsItem(itemId: string): Promise<OsHistoricoItem[]> {
    // 1) chave de junção com o Auvo (o vínculo OS↔ativo é por auvo_equipment_id, E01-S16).
    const { data: item, error: itemErro } = await supabase
      .schema("pcm")
      .from("equipamentos")
      .select("auvo_equipment_id")
      .eq("id", itemId)
      .maybeSingle();
    if (itemErro) throw itemErro;
    const auvoEquipmentId = (item?.auvo_equipment_id as number | null) ?? null;
    if (auvoEquipmentId == null) return []; // sem chave — ativo sem OS vinculável, não é erro

    // 2) OS vinculadas a esse equipamento no Auvo.
    const { data: vinculos, error: vincErro } = await supabase
      .schema("pcm")
      .from("os_equipamentos_auvo")
      .select("ordem_servico_id")
      .eq("auvo_equipment_id", auvoEquipmentId);
    if (vincErro) throw vincErro;
    const osIds = [...new Set((vinculos ?? []).map((v) => v.ordem_servico_id as string))];
    if (osIds.length === 0) return [];

    // 3) dados das OS, mais recente primeiro.
    const { data: ordens, error: osErro } = await supabase
      .schema("pcm")
      .from("ordens_servico")
      .select("id,numero,categoria,status,data_agendada,created_at")
      .in("id", osIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (osErro) throw osErro;
    return ((ordens ?? []) as OsRow[]).map((o) => ({
      osId: o.id,
      numero: o.numero,
      categoria: o.categoria,
      status: o.status,
      data: o.data_agendada ?? o.created_at,
    }));
  },
};
