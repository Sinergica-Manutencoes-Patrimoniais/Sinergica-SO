import { supabase } from "../../../lib/supabase-client";
import type {
  DesativarEquipamentoCommand,
  EditarEquipamentoCommand,
  EquipamentoCommand,
  EquipamentosGateway,
} from "../application/equipamentos-gateway";
import type {
  EquipamentoClienteOpcao,
  EquipamentoItem,
  ItemContexto,
  ItemTipo,
} from "../domain/equipamentos";

interface EquipamentoRow {
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
  // E01-S76
  local_id: string | null;
  tipo: string;
  parent_item_id: string | null;
}

interface ClienteRow {
  id: string;
  nome: string;
  auvo_id: number | null;
}

const COLS =
  "id,nome,identificador,categoria,client_id,auvo_customer_id,localizacao,observacoes,ativo,auvo_id,auvo_sync_status,auvo_sync_error,auvo_synced_at,url_imagem,uri_anexos,local_id,tipo,parent_item_id" as const;

function mapRow(row: EquipamentoRow, clientes: Map<string, string>): EquipamentoItem {
  return {
    id: row.id,
    nome: row.nome,
    identificador: row.identificador,
    categoria: row.categoria,
    clientId: row.client_id,
    clienteNome: row.client_id ? (clientes.get(row.client_id) ?? null) : null,
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

export const supabaseEquipamentosAdapter: EquipamentosGateway = {
  async listar() {
    const [equipamentos, clientes] = await Promise.all([
      supabase
        .schema("pcm")
        .from("equipamentos")
        .select(COLS)
        .is("deleted_at", null)
        .order("nome", { ascending: true }),
      supabase.schema("pcm").from("clientes").select("id,nome").is("deleted_at", null),
    ]);
    if (equipamentos.error) throw equipamentos.error;
    if (clientes.error) throw clientes.error;
    const clientesMap = new Map(
      (clientes.data ?? []).map((c) => [c.id as string, c.nome as string]),
    );
    return ((equipamentos.data ?? []) as EquipamentoRow[]).map((row) => mapRow(row, clientesMap));
  },

  async listarClientes(): Promise<EquipamentoClienteOpcao[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("clientes")
      .select("id,nome,auvo_id")
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as ClienteRow[]).map((row) => ({
      id: row.id,
      nome: row.nome,
      auvoId: row.auvo_id,
    }));
  },

  async criar(input: EquipamentoCommand) {
    const cliente = await buscarCliente(input.clientId ?? null);
    const { data, error } = await supabase
      .schema("pcm")
      .from("equipamentos")
      .insert({
        nome: input.nome,
        identificador: input.identificador,
        categoria: input.categoria,
        client_id: cliente?.id ?? null,
        auvo_customer_id: cliente?.auvoId ?? null,
        localizacao: input.localizacao,
        observacoes: input.observacoes,
        auvo_sync_status: "pending",
        local_id: input.localId ?? null,
        tipo: input.tipo ?? "equipamento",
        parent_item_id: input.parentItemId ?? null,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(COLS)
      .single();
    if (error) throw error;
    return mapRow(data as EquipamentoRow, new Map(cliente ? [[cliente.id, cliente.nome]] : []));
  },

  async editar(input: EditarEquipamentoCommand) {
    const cliente = await buscarCliente(input.clientId ?? null);
    const { data, error } = await supabase
      .schema("pcm")
      .from("equipamentos")
      .update({
        nome: input.nome,
        identificador: input.identificador,
        categoria: input.categoria,
        client_id: cliente?.id ?? null,
        auvo_customer_id: cliente?.auvoId ?? null,
        localizacao: input.localizacao,
        observacoes: input.observacoes,
        auvo_sync_status: "pending",
        local_id: input.localId ?? null,
        tipo: input.tipo ?? "equipamento",
        parent_item_id: input.parentItemId ?? null,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(COLS)
      .single();
    if (error) throw error;
    return mapRow(data as EquipamentoRow, new Map(cliente ? [[cliente.id, cliente.nome]] : []));
  },

  async desativar(input: DesativarEquipamentoCommand) {
    const agora = new Date().toISOString();
    const { error } = await supabase
      .schema("pcm")
      .from("equipamentos")
      .update({
        ativo: false,
        deleted_at: agora,
        auvo_sync_status: "pending",
        updated_at: agora,
        updated_by: input.userId,
      })
      .eq("id", input.id);
    if (error) throw error;
  },

  async possuiOsAberta(id: string) {
    const equipamento = await supabase
      .schema("pcm")
      .from("equipamentos")
      .select("auvo_equipment_id,auvo_id")
      .eq("id", id)
      .maybeSingle();
    if (equipamento.error) throw equipamento.error;
    const auvoId = (equipamento.data?.auvo_equipment_id ?? equipamento.data?.auvo_id) as
      | number
      | null
      | undefined;
    if (auvoId == null) return false;
    const { count, error } = await supabase
      .schema("pcm")
      .from("os_equipamentos_auvo")
      .select("ordem_servico_id", { count: "exact", head: true })
      .eq("auvo_equipment_id", auvoId);
    if (error && !["PGRST205", "42P01"].includes(error.code ?? "")) throw error;
    return (count ?? 0) > 0;
  },

  async obterItem(id): Promise<EquipamentoItem | null> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("equipamentos")
      .select(COLS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as EquipamentoRow;
    const clientesMap = new Map<string, string>();
    if (row.client_id) {
      const cliente = await supabase
        .schema("pcm")
        .from("clientes")
        .select("id,nome")
        .eq("id", row.client_id)
        .maybeSingle();
      if (cliente.data) clientesMap.set(cliente.data.id as string, cliente.data.nome as string);
    }
    return mapRow(row, clientesMap);
  },

  /** AC-6 — breadcrumb Cliente>Área>Local + chips de Sistema + componentes filhos (aninhados sob
   * o Equipamento pai). Sem lib de fetch — várias queries pequenas, supabase-js puro (mesmo padrão
   * dos demais adapters PCM). */
  async obterContextoItem(id): Promise<ItemContexto | null> {
    const item = await this.obterItem(id);
    if (!item) return null;

    let breadcrumb: ItemContexto["breadcrumb"] = null;
    if (item.localId) {
      const local = await supabase
        .schema("pcm")
        .from("locais")
        .select("nome,area_id")
        .eq("id", item.localId)
        .maybeSingle();
      if (local.data) {
        const area = await supabase
          .schema("pcm")
          .from("areas")
          .select("nome")
          .eq("id", local.data.area_id as string)
          .maybeSingle();
        breadcrumb = {
          clienteNome: item.clienteNome,
          areaNome: (area.data?.nome as string | undefined) ?? null,
          localNome: local.data.nome as string,
        };
      }
    } else if (item.clienteNome) {
      breadcrumb = { clienteNome: item.clienteNome, areaNome: null, localNome: null };
    }

    const [membros, filhos] = await Promise.all([
      supabase.schema("pcm").from("sistema_itens").select("sistema_id").eq("item_id", id),
      supabase
        .schema("pcm")
        .from("equipamentos")
        .select(COLS)
        .eq("parent_item_id", id)
        .is("deleted_at", null)
        .order("nome", { ascending: true }),
    ]);
    if (membros.error) throw membros.error;
    if (filhos.error) throw filhos.error;

    const sistemaIds = (membros.data ?? []).map((m) => m.sistema_id as string);
    let sistemas: ItemContexto["sistemas"] = [];
    if (sistemaIds.length > 0) {
      const resultado = await supabase
        .schema("pcm")
        .from("sistemas")
        .select("id,nome,codigo")
        .in("id", sistemaIds)
        .is("deleted_at", null);
      if (resultado.error) throw resultado.error;
      sistemas = (resultado.data ?? []).map((s) => ({
        id: s.id as string,
        nome: s.nome as string,
        codigo: (s.codigo as string | null) ?? null,
      }));
    }

    const componentesFilhos = ((filhos.data ?? []) as EquipamentoRow[]).map((row) =>
      mapRow(
        row,
        item.clienteNome && item.clientId
          ? new Map([[item.clientId, item.clienteNome]])
          : new Map(),
      ),
    );

    return { item, breadcrumb, sistemas, componentesFilhos };
  },
};

async function buscarCliente(
  id: string | null,
): Promise<{ id: string; nome: string; auvoId: number | null } | null> {
  if (!id) return null;
  const { data, error } = await supabase
    .schema("pcm")
    .from("clientes")
    .select("id,nome,auvo_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id as string,
    nome: data.nome as string,
    auvoId: (data.auvo_id as number | null) ?? null,
  };
}
