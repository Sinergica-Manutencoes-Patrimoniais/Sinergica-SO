import { supabase } from "../../../lib/supabase-client";
import type {
  CriarTipoTarefaInput,
  EditarTipoTarefaInput,
  ExcluirTipoTarefaInput,
  TiposTarefaGateway,
} from "../application/tipos-tarefa-gateway";
import type { TipoTarefa } from "../domain/tipos-tarefa";

interface TipoTarefaRow {
  id: string;
  nome: string;
  preenche_relato: boolean;
  exige_assinatura: boolean;
  fotos_minimas: number;
  ativo: boolean;
  auvo_id: number | null;
  auvo_sync_status: string | null;
  auvo_sync_error: string | null;
  auvo_synced_at: string | null;
}

const COLS =
  "id,nome,preenche_relato,exige_assinatura,fotos_minimas,ativo,auvo_id,auvo_sync_status,auvo_sync_error,auvo_synced_at" as const;

function mapRow(row: TipoTarefaRow): TipoTarefa {
  return {
    id: row.id,
    nome: row.nome,
    preencheRelato: row.preenche_relato,
    exigeAssinatura: row.exige_assinatura,
    fotosMinimas: row.fotos_minimas,
    ativo: row.ativo,
    auvoId: row.auvo_id,
    auvoSyncStatus: row.auvo_sync_status,
    auvoSyncError: row.auvo_sync_error,
    auvoSyncedAt: row.auvo_synced_at,
  };
}

export const supabaseTiposTarefaAdapter: TiposTarefaGateway = {
  async listar() {
    const { data, error } = await supabase
      .schema("pcm")
      .from("tipos_tarefa")
      .select(COLS)
      .is("deleted_at", null)
      .order("nome", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as TipoTarefaRow[]).map(mapRow);
  },

  async criar(input: CriarTipoTarefaInput) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("tipos_tarefa")
      .insert({
        nome: input.nome,
        preenche_relato: input.preencheRelato,
        exige_assinatura: input.exigeAssinatura,
        fotos_minimas: input.fotosMinimas,
        ativo: input.ativo ?? true,
        auvo_sync_status: "pending",
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(COLS)
      .single();

    if (error) throw error;
    return mapRow(data as TipoTarefaRow);
  },

  async editar(input: EditarTipoTarefaInput) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("tipos_tarefa")
      .update({
        nome: input.nome,
        preenche_relato: input.preencheRelato,
        exige_assinatura: input.exigeAssinatura,
        fotos_minimas: input.fotosMinimas,
        ativo: input.ativo ?? true,
        auvo_sync_status: "pending",
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(COLS)
      .single();

    if (error) throw error;
    return mapRow(data as TipoTarefaRow);
  },

  async excluir(input: ExcluirTipoTarefaInput) {
    const { error } = await supabase
      .schema("pcm")
      .from("tipos_tarefa")
      .update({
        ativo: false,
        deleted_at: new Date().toISOString(),
        auvo_sync_status: "pending",
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id);

    if (error) throw error;
  },
};
