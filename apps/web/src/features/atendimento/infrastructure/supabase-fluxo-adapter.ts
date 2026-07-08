import { supabase } from "../../../lib/supabase-client";
import type {
  CriarFluxoCommand,
  DesativarFluxoCommand,
  FluxoGateway,
  SalvarPassosCommand,
} from "../application/fluxo-gateway";
import type { FluxoItem, PassoFluxo } from "../domain/fluxos";

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
      .insert({ nome: input.nome, persona_id: input.personaId, created_by: input.userId })
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
};
