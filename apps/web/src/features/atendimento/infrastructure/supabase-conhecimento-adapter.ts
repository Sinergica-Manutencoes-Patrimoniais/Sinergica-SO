import { supabase } from "../../../lib/supabase-client";
import type {
  ConhecimentoGateway,
  CriarConhecimentoEntradaInput,
  EditarConhecimentoEntradaInput,
} from "../application/conhecimento-gateway";
import type { ConhecimentoEntradaItem } from "../domain/conhecimento";

interface ConhecimentoRow {
  id: string;
  persona_id: string | null;
  titulo: string;
  conteudo: string;
  categoria: string;
  tags: string[];
  prioridade: number;
  ativo: boolean;
}

const COLUNAS = "id,persona_id,titulo,conteudo,categoria,tags,prioridade,ativo";

function mapEntrada(row: ConhecimentoRow): ConhecimentoEntradaItem {
  return {
    id: row.id,
    personaId: row.persona_id,
    titulo: row.titulo,
    conteudo: row.conteudo,
    categoria: row.categoria,
    tags: row.tags,
    prioridade: row.prioridade,
    ativo: row.ativo,
  };
}

export const supabaseConhecimentoAdapter: ConhecimentoGateway = {
  async listarEntradas() {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("conhecimento_entradas")
      .select(COLUNAS)
      .order("categoria")
      .order("titulo");
    if (error) throw error;
    return ((data ?? []) as ConhecimentoRow[]).map(mapEntrada);
  },

  async criarEntrada(input: CriarConhecimentoEntradaInput) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("conhecimento_entradas")
      .insert({
        persona_id: input.personaId,
        titulo: input.titulo,
        conteudo: input.conteudo,
        categoria: input.categoria,
        tags: input.tags,
        prioridade: input.prioridade,
        created_by: input.userId,
      })
      .select(COLUNAS)
      .single();
    if (error) throw error;
    return mapEntrada(data as ConhecimentoRow);
  },

  async editarEntrada(input: EditarConhecimentoEntradaInput) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("conhecimento_entradas")
      .update({
        persona_id: input.personaId,
        titulo: input.titulo,
        conteudo: input.conteudo,
        categoria: input.categoria,
        tags: input.tags,
        prioridade: input.prioridade,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(COLUNAS)
      .single();
    if (error) throw error;
    return mapEntrada(data as ConhecimentoRow);
  },

  async desativarEntrada(id: string) {
    const { error } = await supabase
      .schema("atendimento")
      .from("conhecimento_entradas")
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
};
