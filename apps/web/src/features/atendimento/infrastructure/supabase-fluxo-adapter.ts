import { supabase } from "../../../lib/supabase-client";
import type {
  CriarFluxoCommand,
  DesativarFluxoCommand,
  FluxoGateway,
  SalvarPassosCommand,
} from "../application/fluxo-gateway";
import type { FluxoItem, FluxoLog, FluxoRecipe, PassoFluxo } from "../domain/fluxos";

interface FluxoRow {
  id: string;
  persona_id: string;
  nome: string;
  definicao: PassoFluxo[];
  ativo: boolean;
}

function mapFluxo(row: FluxoRow): FluxoItem {
  return {
    id: row.id,
    personaId: row.persona_id,
    nome: row.nome,
    passos: row.definicao ?? [],
    ativo: row.ativo,
  };
}

const COLS = "id,persona_id,nome,definicao,ativo" as const;

export const supabaseFluxoAdapter: FluxoGateway = {
  async listarFluxos() {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("fluxos")
      .select(COLS)
      .order("nome");
    if (error) throw error;
    return ((data ?? []) as FluxoRow[]).map(mapFluxo);
  },

  async criarFluxo(input: CriarFluxoCommand) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("fluxos")
      .insert({
        nome: input.nome,
        persona_id: input.personaId,
        definicao: input.definicao ?? [],
        created_by: input.userId,
      })
      .select(COLS)
      .single();
    if (error) throw error;
    return mapFluxo(data as FluxoRow);
  },

  async salvarPassos(input: SalvarPassosCommand) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("fluxos")
      .update({
        definicao: input.passos,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.fluxoId)
      .select(COLS)
      .single();
    if (error) throw error;
    return mapFluxo(data as FluxoRow);
  },

  async desativarFluxo(input: DesativarFluxoCommand) {
    const { error } = await supabase
      .schema("atendimento")
      .from("fluxos")
      .update({ ativo: false, updated_at: new Date().toISOString(), updated_by: input.userId })
      .eq("id", input.id);
    if (error) throw error;
  },

  async listarRecipes() {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("fluxo_recipes")
      .select("id,nome,descricao,definicao")
      .eq("ativo", true)
      .order("nome");
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id as string,
      nome: row.nome as string,
      descricao: row.descricao as string,
      definicao: row.definicao as PassoFluxo[],
    })) satisfies FluxoRecipe[];
  },

  async listarLogs(fluxoId) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("fluxo_logs")
      .select("id,fluxo_id,conversa_id,nos_percorridos,entrada,saida,created_at")
      .eq("fluxo_id", fluxoId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id as string,
      fluxoId: row.fluxo_id as string,
      conversaId: row.conversa_id as string,
      nosPercorridos: row.nos_percorridos as string[],
      entrada: row.entrada as Record<string, unknown>,
      saida: row.saida as Record<string, unknown>,
      createdAt: row.created_at as string,
    })) satisfies FluxoLog[];
  },
};
