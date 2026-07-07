import { supabase } from "../../../lib/supabase-client";
import type {
  DesativarServicoCommand,
  EditarServicoCommand,
  ServicoCommand,
  ServicosGateway,
} from "../application/servicos-gateway";
import type { ServicoItem } from "../domain/servicos";

interface ServicoRow {
  id: string;
  titulo: string;
  descricao: string | null;
  preco_centavos: number;
  ativo: boolean;
  auvo_id: string | null;
  auvo_sync_status: string | null;
  auvo_sync_error: string | null;
  auvo_synced_at: string | null;
}

const COLS =
  "id,titulo,descricao,preco_centavos,ativo,auvo_id,auvo_sync_status,auvo_sync_error,auvo_synced_at" as const;

function mapRow(row: ServicoRow): ServicoItem {
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    precoCentavos: row.preco_centavos,
    ativo: row.ativo,
    auvoId: row.auvo_id,
    auvoSyncStatus: row.auvo_sync_status,
    auvoSyncError: row.auvo_sync_error,
    auvoSyncedAt: row.auvo_synced_at,
  };
}

export const supabaseServicosAdapter: ServicosGateway = {
  async listar() {
    const { data, error } = await supabase
      .schema("pcm")
      .from("servicos")
      .select(COLS)
      .is("deleted_at", null)
      .order("titulo", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as ServicoRow[]).map(mapRow);
  },

  async criar(input: ServicoCommand) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("servicos")
      .insert({
        titulo: input.titulo,
        descricao: input.descricao,
        preco_centavos: input.precoCentavos,
        auvo_sync_status: "pending",
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(COLS)
      .single();
    if (error) throw error;
    return mapRow(data as ServicoRow);
  },

  async editar(input: EditarServicoCommand) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("servicos")
      .update({
        titulo: input.titulo,
        descricao: input.descricao,
        preco_centavos: input.precoCentavos,
        auvo_sync_status: "pending",
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(COLS)
      .single();
    if (error) throw error;
    return mapRow(data as ServicoRow);
  },

  async desativar(input: DesativarServicoCommand) {
    const agora = new Date().toISOString();
    const { error } = await supabase
      .schema("pcm")
      .from("servicos")
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
