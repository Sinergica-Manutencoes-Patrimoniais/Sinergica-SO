import { supabase } from "../../../lib/supabase-client";
import type { ClienteResumo } from "../application/cliente-360-gateway";
import type {
  ClienteGrupoCommand,
  ClienteGruposGateway,
  EditarClienteGrupoCommand,
  ExcluirClienteGrupoCommand,
} from "../application/cliente-grupos-gateway";
import type { ClienteGrupoItem } from "../domain/cliente-grupos";

interface ClienteGrupoRow {
  id: string;
  nome: string;
  cliente_ids: string[];
  clientes_auvo_ids: number[];
  auvo_id: number | null;
  auvo_sync_status: string | null;
  auvo_sync_error: string | null;
  auvo_synced_at: string | null;
}

interface ClienteGrupoClienteRow {
  id: string;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  auvo_id: number | null;
  tipo: "cliente" | "lead";
}

const GRUPO_COLS =
  "id,nome,cliente_ids,clientes_auvo_ids,auvo_id,auvo_sync_status,auvo_sync_error,auvo_synced_at" as const;

function mapGrupo(row: ClienteGrupoRow): ClienteGrupoItem {
  return {
    id: row.id,
    nome: row.nome,
    clienteIds: row.cliente_ids ?? [],
    clientesAuvoIds: row.clientes_auvo_ids ?? [],
    auvoId: row.auvo_id,
    auvoSyncStatus: row.auvo_sync_status,
    auvoSyncError: row.auvo_sync_error,
    auvoSyncedAt: row.auvo_synced_at,
  };
}

async function resolverAuvoIds(clienteIds: string[]): Promise<number[]> {
  const { data, error } = await supabase
    .schema("pcm")
    .from("clientes")
    .select("id,auvo_id")
    .in("id", clienteIds)
    .is("deleted_at", null);

  if (error) throw error;
  const auvoIds = (data ?? [])
    .map((cliente) => cliente.auvo_id as number | null)
    .filter((id): id is number => id !== null);
  if (auvoIds.length !== clienteIds.length) {
    throw new Error("Todos os clientes do grupo precisam estar sincronizados com o Auvo.");
  }
  return auvoIds;
}

export const supabaseClienteGruposAdapter: ClienteGruposGateway = {
  async listar() {
    const { data, error } = await supabase
      .schema("pcm")
      .from("cliente_grupos")
      .select(GRUPO_COLS)
      .is("deleted_at", null)
      .order("nome", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as ClienteGrupoRow[]).map(mapGrupo);
  },

  async listarClientesSincronizados(): Promise<ClienteResumo[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("clientes")
      .select("id,nome,cnpj,ativo,auvo_id,tipo")
      .eq("ativo", true)
      .not("auvo_id", "is", null)
      .is("deleted_at", null)
      .order("nome", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as ClienteGrupoClienteRow[]).map((row) => ({
      id: row.id,
      nome: row.nome,
      cnpj: row.cnpj,
      ativo: row.ativo,
      auvoId: row.auvo_id,
      tipo: row.tipo,
    }));
  },

  async criar(input: ClienteGrupoCommand) {
    const clientesAuvoIds = await resolverAuvoIds(input.clienteIds);
    const { data, error } = await supabase
      .schema("pcm")
      .from("cliente_grupos")
      .insert({
        nome: input.nome,
        cliente_ids: input.clienteIds,
        clientes_auvo_ids: clientesAuvoIds,
        auvo_sync_status: "pending",
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(GRUPO_COLS)
      .single();

    if (error) throw error;
    return mapGrupo(data as ClienteGrupoRow);
  },

  async editar(input: EditarClienteGrupoCommand) {
    const clientesAuvoIds = await resolverAuvoIds(input.clienteIds);
    const { data, error } = await supabase
      .schema("pcm")
      .from("cliente_grupos")
      .update({
        nome: input.nome,
        cliente_ids: input.clienteIds,
        clientes_auvo_ids: clientesAuvoIds,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(GRUPO_COLS)
      .single();

    if (error) throw error;
    return mapGrupo(data as ClienteGrupoRow);
  },

  async excluir(input: ExcluirClienteGrupoCommand) {
    const { error } = await supabase
      .schema("pcm")
      .from("cliente_grupos")
      .update({
        deleted_at: new Date().toISOString(),
        auvo_sync_status: "pending",
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id);

    if (error) throw error;
  },
};
