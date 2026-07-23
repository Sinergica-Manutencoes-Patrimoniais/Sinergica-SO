import { supabase } from "../../../lib/supabase-client";
import type {
  EditarSistemaCommand,
  SistemaCommand,
  SistemaItemOpcao,
  SistemasGateway,
} from "../application/sistemas-gateway";
import { agregarHistoricoSistema } from "../domain/historico-ativo";
import type { OsHistoricoItem } from "../domain/historico-ativo";
import type { Sistema, SistemaItemMembro } from "../domain/sistemas";

interface SistemaRow {
  id: string;
  cliente_id: string;
  area_id: string | null;
  nome: string;
  tipo: string | null;
  descricao: string | null;
  ativo: boolean;
  auvo_id: number | null;
  auvo_equipment_id: number | null;
  codigo: string | null;
  auvo_sync_status: string | null;
  auvo_sync_error: string | null;
  auvo_synced_at: string | null;
}

interface SistemaItemRow {
  id: string;
  sistema_id: string;
  item_id: string;
}

interface ItemOpcaoRow {
  id: string;
  nome: string;
  client_id: string | null;
}

const SISTEMA_COLS =
  "id,cliente_id,area_id,nome,tipo,descricao,ativo,auvo_id,auvo_equipment_id,codigo,auvo_sync_status,auvo_sync_error,auvo_synced_at" as const;

function mapSistema(row: SistemaRow): Sistema {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    areaId: row.area_id,
    nome: row.nome,
    tipo: row.tipo,
    descricao: row.descricao,
    ativo: row.ativo,
    auvoId: row.auvo_id,
    auvoEquipmentId: row.auvo_equipment_id,
    codigo: row.codigo,
    auvoSyncStatus: row.auvo_sync_status,
    auvoSyncError: row.auvo_sync_error,
    auvoSyncedAt: row.auvo_synced_at,
  };
}

export const supabaseSistemasAdapter: SistemasGateway = {
  async listar(clienteId) {
    let query = supabase.schema("pcm").from("sistemas").select(SISTEMA_COLS).is("deleted_at", null);
    if (clienteId) query = query.eq("cliente_id", clienteId);
    const { data, error } = await query.order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as SistemaRow[]).map(mapSistema);
  },

  async obter(id) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("sistemas")
      .select(SISTEMA_COLS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSistema(data as SistemaRow) : null;
  },

  async criar(input: SistemaCommand) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("sistemas")
      .insert({
        cliente_id: input.clienteId,
        area_id: input.areaId,
        nome: input.nome,
        tipo: input.tipo,
        descricao: input.descricao,
        auvo_sync_status: "pending",
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(SISTEMA_COLS)
      .single();
    if (error) throw error;
    return mapSistema(data as SistemaRow);
  },

  async editar(input: EditarSistemaCommand) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("sistemas")
      .update({
        area_id: input.areaId,
        nome: input.nome,
        tipo: input.tipo,
        descricao: input.descricao,
        auvo_sync_status: "pending",
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(SISTEMA_COLS)
      .single();
    if (error) throw error;
    return mapSistema(data as SistemaRow);
  },

  async desativar(id, userId) {
    const agora = new Date().toISOString();
    const { error } = await supabase
      .schema("pcm")
      .from("sistemas")
      .update({
        ativo: false,
        deleted_at: agora,
        auvo_sync_status: "pending",
        updated_at: agora,
        updated_by: userId,
      })
      .eq("id", id);
    if (error) throw error;
  },

  async listarItensDisponiveis(clienteId): Promise<SistemaItemOpcao[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("equipamentos")
      .select("id,nome,client_id")
      .eq("client_id", clienteId)
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as ItemOpcaoRow[]).map((row) => ({
      id: row.id,
      nome: row.nome,
      clientId: row.client_id,
    }));
  },

  async listarItensDoSistema(sistemaId): Promise<SistemaItemMembro[]> {
    const [membros, itens] = await Promise.all([
      supabase
        .schema("pcm")
        .from("sistema_itens")
        .select("id,sistema_id,item_id")
        .eq("sistema_id", sistemaId),
      supabase
        .schema("pcm")
        .from("equipamentos")
        .select("id,nome,client_id")
        .is("deleted_at", null),
    ]);
    if (membros.error) throw membros.error;
    if (itens.error) throw itens.error;
    const itensMap = new Map((itens.data ?? []).map((i) => [i.id as string, i as ItemOpcaoRow]));
    return ((membros.data ?? []) as SistemaItemRow[]).map((row) => {
      const item = itensMap.get(row.item_id);
      return {
        id: row.id,
        sistemaId: row.sistema_id,
        itemId: row.item_id,
        itemNome: item?.nome ?? "Item removido",
        itemClienteId: item?.client_id ?? "",
      };
    });
  },

  async adicionarItem(sistemaId, itemId, userId): Promise<SistemaItemMembro> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("sistema_itens")
      .insert({ sistema_id: sistemaId, item_id: itemId, created_by: userId })
      .select("id,sistema_id,item_id")
      .single();
    if (error) throw error;
    const item = await supabase
      .schema("pcm")
      .from("equipamentos")
      .select("id,nome,client_id")
      .eq("id", itemId)
      .maybeSingle();
    const row = data as SistemaItemRow;
    return {
      id: row.id,
      sistemaId: row.sistema_id,
      itemId: row.item_id,
      itemNome: (item.data?.nome as string | undefined) ?? "",
      itemClienteId: (item.data?.client_id as string | undefined) ?? "",
    };
  },

  async removerItem(sistemaId, itemId) {
    const { error } = await supabase
      .schema("pcm")
      .from("sistema_itens")
      .delete()
      .eq("sistema_id", sistemaId)
      .eq("item_id", itemId);
    if (error) throw error;
  },

  async listarHistoricoOsSistema(sistemaId): Promise<OsHistoricoItem[]> {
    // AC-2: duas fontes — OS vinculadas ao Sistema em si (E01-S76/S85 — sobe como Equipment) e OS
    // vinculadas a qualquer um dos seus Componentes/Itens membros. `agregarHistoricoSistema`
    // (domínio) junta e deduplica — a mesma OS pode aparecer nas duas fontes.
    const [sistemaRes, membrosRes] = await Promise.all([
      supabase
        .schema("pcm")
        .from("sistemas")
        .select("auvo_equipment_id")
        .eq("id", sistemaId)
        .maybeSingle(),
      supabase.schema("pcm").from("sistema_itens").select("item_id").eq("sistema_id", sistemaId),
    ]);
    if (sistemaRes.error) throw sistemaRes.error;
    if (membrosRes.error) throw membrosRes.error;

    const itemIds = (membrosRes.data ?? []).map((row) => row.item_id as string);
    let auvoEquipmentIdsComponentes: number[] = [];
    if (itemIds.length > 0) {
      const { data: itens, error: itensErro } = await supabase
        .schema("pcm")
        .from("equipamentos")
        .select("auvo_equipment_id")
        .in("id", itemIds);
      if (itensErro) throw itensErro;
      auvoEquipmentIdsComponentes = (itens ?? [])
        .map((row) => row.auvo_equipment_id as number | null)
        .filter((id): id is number => id != null);
    }
    const auvoEquipmentIdSistema =
      (sistemaRes.data?.auvo_equipment_id as number | null | undefined) ?? null;

    const [historicoSistema, historicoComponentes] = await Promise.all([
      buscarHistoricoPorAuvoIds(auvoEquipmentIdSistema == null ? [] : [auvoEquipmentIdSistema]),
      buscarHistoricoPorAuvoIds(auvoEquipmentIdsComponentes),
    ]);
    return agregarHistoricoSistema([historicoSistema, historicoComponentes]);
  },
};

async function buscarHistoricoPorAuvoIds(auvoEquipmentIds: number[]): Promise<OsHistoricoItem[]> {
  const ids = [...new Set(auvoEquipmentIds)];
  if (ids.length === 0) return [];

  const { data: vinculos, error: vincErro } = await supabase
    .schema("pcm")
    .from("os_equipamentos_auvo")
    .select("ordem_servico_id")
    .in("auvo_equipment_id", ids);
  if (vincErro) throw vincErro;
  const osIds = [...new Set((vinculos ?? []).map((v) => v.ordem_servico_id as string))];
  if (osIds.length === 0) return [];

  const { data: ordens, error: osErro } = await supabase
    .schema("pcm")
    .from("ordens_servico")
    .select("id,numero,categoria,status,data_agendada,created_at")
    .in("id", osIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (osErro) throw osErro;
  return (
    (ordens ?? []) as Array<{
      id: string;
      numero: string;
      categoria: string | null;
      status: string | null;
      data_agendada: string | null;
      created_at: string | null;
    }>
  ).map((o) => ({
    osId: o.id,
    numero: o.numero,
    categoria: o.categoria,
    status: o.status,
    data: o.data_agendada ?? o.created_at,
  }));
}
