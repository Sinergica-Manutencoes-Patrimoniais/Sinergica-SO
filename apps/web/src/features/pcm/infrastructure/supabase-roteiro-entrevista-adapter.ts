import { supabase } from "../../../lib/supabase-client";
import type { RoteiroEntrevistaGateway } from "../application/roteiro-entrevista-gateway";
import type { PerguntaRoteiro, RoteiroEntrevista } from "../domain/roteiro-entrevista";

export const supabaseRoteiroEntrevistaAdapter: RoteiroEntrevistaGateway = {
  async listar(): Promise<RoteiroEntrevista[]> {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("roteiro_entrevista")
      .select("id,nome,ativo,perguntas")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((linha) => ({
      id: linha.id as string,
      nome: linha.nome as string,
      ativo: Boolean(linha.ativo),
      perguntas: (linha.perguntas as PerguntaRoteiro[] | null) ?? [],
    }));
  },

  async criar(input): Promise<void> {
    const { error } = await supabase.schema("atendimento").from("roteiro_entrevista").insert({
      nome: input.nome,
      perguntas: input.perguntas,
      created_by: input.userId,
      updated_by: input.userId,
    });
    if (error) throw error;
  },

  async editar(input): Promise<void> {
    const { error } = await supabase
      .schema("atendimento")
      .from("roteiro_entrevista")
      .update({
        nome: input.nome,
        perguntas: input.perguntas,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id);
    if (error) throw error;
  },

  async alternarAtivo(input): Promise<void> {
    const { error } = await supabase
      .schema("atendimento")
      .from("roteiro_entrevista")
      .update({
        ativo: input.ativo,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id);
    if (error) throw error;
  },
};
