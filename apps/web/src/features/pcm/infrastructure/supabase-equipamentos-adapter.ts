import { supabase } from "../../../lib/supabase-client";
import type {
  DesativarEquipamentoCommand,
  EditarEquipamentoCommand,
  EquipamentoCommand,
  EquipamentosGateway,
} from "../application/equipamentos-gateway";
import type { EquipamentoClienteOpcao, EquipamentoItem } from "../domain/equipamentos";

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
}

interface ClienteRow {
  id: string;
  nome: string;
  auvo_id: number | null;
}

const COLS =
  "id,nome,identificador,categoria,client_id,auvo_customer_id,localizacao,observacoes,ativo,auvo_id,auvo_sync_status,auvo_sync_error,auvo_synced_at" as const;

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
