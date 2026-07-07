import { supabase } from "../../../lib/supabase-client";
import type {
  CatalogoSimplesCommand,
  CatalogosSimplesGateway,
  EditarCatalogoSimplesCommand,
  ExcluirCatalogoSimplesCommand,
} from "../application/catalogos-simples-gateway";
import type { CatalogoSimplesItem, CatalogoSimplesTipo } from "../domain/catalogos-simples";

interface CatalogoSimplesRow {
  id: string;
  descricao?: string | null;
  auvo_id: number | null;
  auvo_sync_status: string | null;
  auvo_sync_error: string | null;
  auvo_synced_at: string | null;
}

const COLS = "id,descricao,auvo_id,auvo_sync_status,auvo_sync_error,auvo_synced_at" as const;
const CATEGORY_COLS = "id,nome,auvo_id,auvo_sync_status,auvo_sync_error,auvo_synced_at" as const;

const TABELA: Record<
  CatalogoSimplesTipo,
  "segmentos" | "palavras_chave" | "produto_categorias" | "equipamento_categorias"
> = {
  equipamento_categorias: "equipamento_categorias",
  produto_categorias: "produto_categorias",
  segmentos: "segmentos",
  palavras_chave: "palavras_chave",
};

function isCategoria(tipo: CatalogoSimplesTipo): boolean {
  return tipo === "produto_categorias" || tipo === "equipamento_categorias";
}

function textColumn(tipo: CatalogoSimplesTipo): "descricao" | "nome" {
  return isCategoria(tipo) ? "nome" : "descricao";
}

function selectCols(tipo: CatalogoSimplesTipo): typeof COLS | typeof CATEGORY_COLS {
  return isCategoria(tipo) ? CATEGORY_COLS : COLS;
}

function mapRow(row: CatalogoSimplesRow & { nome?: string | null }): CatalogoSimplesItem {
  return {
    id: row.id,
    descricao: row.descricao ?? row.nome ?? "",
    auvoId: row.auvo_id,
    auvoSyncStatus: row.auvo_sync_status,
    auvoSyncError: row.auvo_sync_error,
    auvoSyncedAt: row.auvo_synced_at,
  };
}

export const supabaseCatalogosSimplesAdapter: CatalogosSimplesGateway = {
  async listar(tipo: CatalogoSimplesTipo) {
    const { data, error } = await supabase
      .schema("pcm")
      .from(TABELA[tipo])
      .select(selectCols(tipo))
      .is("deleted_at", null)
      .order(textColumn(tipo), { ascending: true });

    if (error) throw error;
    return ((data ?? []) as CatalogoSimplesRow[]).map(mapRow);
  },

  async criar(input: CatalogoSimplesCommand) {
    const { data, error } = await supabase
      .schema("pcm")
      .from(TABELA[input.tipo])
      .insert({
        [textColumn(input.tipo)]: input.descricao,
        auvo_sync_status: "pending",
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(selectCols(input.tipo))
      .single();

    if (error) throw error;
    return mapRow(data as CatalogoSimplesRow);
  },

  async editar(input: EditarCatalogoSimplesCommand) {
    const { data, error } = await supabase
      .schema("pcm")
      .from(TABELA[input.tipo])
      .update({
        [textColumn(input.tipo)]: input.descricao,
        auvo_sync_status: "pending",
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(selectCols(input.tipo))
      .single();

    if (error) throw error;
    return mapRow(data as CatalogoSimplesRow);
  },

  async excluir(input: ExcluirCatalogoSimplesCommand) {
    const { error } = await supabase
      .schema("pcm")
      .from(TABELA[input.tipo])
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
