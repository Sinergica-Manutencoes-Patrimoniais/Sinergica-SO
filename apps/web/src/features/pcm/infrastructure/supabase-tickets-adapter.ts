import { supabase } from "../../../lib/supabase-client";
import type {
  ArquivarTicketCommand,
  MudarStatusTicketCommand,
  TicketCommand,
  TicketsGateway,
} from "../application/tickets-gateway";
import type {
  TicketClienteOpcao,
  TicketEquipeOpcao,
  TicketItem,
  TicketReferenciaOpcao,
} from "../domain/tickets";

interface TicketRow {
  id: string;
  titulo: string;
  descricao: string | null;
  cliente_id: string | null;
  equipe_id: string | null;
  responsavel_auvo_user_id: number | null;
  prioridade: number | null;
  request_type_id: number | null;
  status_id: number | null;
  ativo: boolean;
  auvo_id: number | null;
  auvo_sync_status: string | null;
  auvo_sync_error: string | null;
}

interface ClienteRow {
  id: string;
  nome: string;
  auvo_id: number | null;
}

interface EquipeRow {
  id: string;
  nome: string;
  auvo_id: number | null;
}

const COLS =
  "id,titulo,descricao,cliente_id,equipe_id,responsavel_auvo_user_id,prioridade,request_type_id,status_id,ativo,auvo_id,auvo_sync_status,auvo_sync_error" as const;

function mapRow(
  row: TicketRow,
  clientes: Map<string, string>,
  equipes: Map<string, string>,
): TicketItem {
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    clienteId: row.cliente_id,
    clienteNome: row.cliente_id ? (clientes.get(row.cliente_id) ?? null) : null,
    equipeId: row.equipe_id,
    equipeNome: row.equipe_id ? (equipes.get(row.equipe_id) ?? null) : null,
    responsavelAuvoUserId: row.responsavel_auvo_user_id,
    prioridade: row.prioridade,
    requestTypeId: row.request_type_id,
    statusId: row.status_id,
    ativo: row.ativo,
    auvoId: row.auvo_id,
    auvoSyncStatus: row.auvo_sync_status,
    auvoSyncError: row.auvo_sync_error,
  };
}

export const supabaseTicketsAdapter: TicketsGateway = {
  async listar() {
    const [tickets, clientes, equipes] = await Promise.all([
      supabase
        .schema("pcm")
        .from("tickets")
        .select(COLS)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      this.listarClientes(),
      this.listarEquipes(),
    ]);
    if (tickets.error) throw tickets.error;
    const clientesMap = new Map(clientes.map((item) => [item.id, item.nome]));
    const equipesMap = new Map(equipes.map((item) => [item.id, item.nome]));
    return ((tickets.data ?? []) as TicketRow[]).map((row) => mapRow(row, clientesMap, equipesMap));
  },

  async listarClientes(): Promise<TicketClienteOpcao[]> {
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

  async listarEquipes(): Promise<TicketEquipeOpcao[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("equipes")
      .select("id,nome,auvo_id")
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as EquipeRow[]).map((row) => ({
      id: row.id,
      nome: row.nome,
      auvoId: row.auvo_id,
    }));
  },

  async listarReferencia(lista): Promise<TicketReferenciaOpcao[]> {
    const { data, error } = await supabase.functions.invoke<{
      itens: Array<Record<string, unknown>>;
    }>("pcm-auvo-tickets-referencia", { body: { lista } });
    if (error) throw error;
    return (data?.itens ?? []).map((item) => ({
      id: Number(item.id ?? item.requestTypeId ?? item.statusId ?? 0),
      nome: String(item.name ?? item.description ?? item.id ?? ""),
    }));
  },

  async criar(input: TicketCommand) {
    const [clientes, equipes] = await Promise.all([this.listarClientes(), this.listarEquipes()]);
    const cliente = clientes.find((item) => item.id === input.clienteId) ?? null;
    const equipe = input.equipeId
      ? (equipes.find((item) => item.id === input.equipeId) ?? null)
      : null;
    const { data, error } = await supabase
      .schema("pcm")
      .from("tickets")
      .insert({
        titulo: input.titulo,
        descricao: input.descricao,
        cliente_id: input.clienteId,
        cliente_auvo_id: cliente?.auvoId ?? null,
        equipe_id: input.equipeId,
        equipe_auvo_id: equipe?.auvoId ?? null,
        prioridade: input.prioridade,
        request_type_id: input.requestTypeId,
        status_id: input.statusId,
        auvo_sync_status: "pending",
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(COLS)
      .single();
    if (error) throw error;
    const clientesMap = new Map(clientes.map((item) => [item.id, item.nome]));
    const equipesMap = new Map(equipes.map((item) => [item.id, item.nome]));
    return mapRow(data as TicketRow, clientesMap, equipesMap);
  },

  async mudarStatus(input: MudarStatusTicketCommand) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("tickets")
      .update({
        status_id: input.statusId,
        auvo_sync_status: "pending",
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(COLS)
      .single();
    if (error) throw error;
    const [clientes, equipes] = await Promise.all([this.listarClientes(), this.listarEquipes()]);
    const clientesMap = new Map(clientes.map((item) => [item.id, item.nome]));
    const equipesMap = new Map(equipes.map((item) => [item.id, item.nome]));
    return mapRow(data as TicketRow, clientesMap, equipesMap);
  },

  async arquivar(input: ArquivarTicketCommand) {
    const agora = new Date().toISOString();
    const { error } = await supabase
      .schema("pcm")
      .from("tickets")
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
};
