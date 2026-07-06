import { supabase } from "../../../lib/supabase-client";
import type { AlterarStatusOsInput, HubOsGateway } from "../application/hub-os-gateway";
import type { OrdemServicoOperacional } from "../domain/ordens-servico";

interface ClienteRow {
  id: string;
  nome: string;
}

interface OrdemRow {
  id: string;
  client_id: string;
  numero: string;
  titulo: string;
  descricao: string | null;
  categoria: string;
  status: string;
  prioridade: string;
  gravidade: number | null;
  urgencia: number | null;
  tendencia: number | null;
  score_pcm: number;
  local_descricao: string | null;
  solicitante: string | null;
  origem: string;
  auvo_task_id: number | null;
  auvo_sync_status: string | null;
  auvo_sync_error: string | null;
  created_at: string;
  updated_at: string | null;
}

const COLUNAS_OS =
  "id,client_id,numero,titulo,descricao,categoria,status,prioridade,gravidade,urgencia,tendencia,score_pcm,local_descricao,solicitante,origem,auvo_task_id,auvo_sync_status,auvo_sync_error,created_at,updated_at" as const;

function mapearOrdem(row: OrdemRow, clientes: Map<string, string>): OrdemServicoOperacional {
  return {
    id: row.id,
    clientId: row.client_id,
    numero: row.numero,
    titulo: row.titulo,
    clienteNome: clientes.get(row.client_id) ?? "Cliente não identificado",
    categoria: row.categoria,
    status: row.status,
    prioridade: row.prioridade,
    scorePcm: row.score_pcm,
    gravidade: row.gravidade,
    urgencia: row.urgencia,
    tendencia: row.tendencia,
    auvoTaskId: row.auvo_task_id,
    auvoSyncStatus: row.auvo_sync_status,
    auvoSyncError: row.auvo_sync_error,
    createdAt: row.created_at,
  };
}

async function clientesPorId(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .schema("pcm")
    .from("clientes")
    .select("id,nome")
    .is("deleted_at", null);
  if (error) throw error;
  return new Map(((data ?? []) as ClienteRow[]).map((cliente) => [cliente.id, cliente.nome]));
}

async function buscarOrdem(id: string): Promise<OrdemRow> {
  const { data, error } = await supabase
    .schema("pcm")
    .from("ordens_servico")
    .select(COLUNAS_OS)
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) throw error;
  return data as OrdemRow;
}

export const supabaseHubOsAdapter: HubOsGateway = {
  async listarOrdensServico(): Promise<OrdemServicoOperacional[]> {
    const [clientes, { data, error }] = await Promise.all([
      clientesPorId(),
      supabase
        .schema("pcm")
        .from("ordens_servico")
        .select(COLUNAS_OS)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (error) throw error;
    return ((data ?? []) as OrdemRow[]).map((row) => mapearOrdem(row, clientes));
  },

  async alterarStatus(input: AlterarStatusOsInput): Promise<OrdemServicoOperacional> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("ordens_servico")
      .update({
        status: input.status,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy,
      })
      .eq("id", input.id)
      .is("deleted_at", null)
      .select(COLUNAS_OS)
      .single();

    if (error) throw error;
    const clientes = await clientesPorId();
    return mapearOrdem((data ?? (await buscarOrdem(input.id))) as OrdemRow, clientes);
  },
};
