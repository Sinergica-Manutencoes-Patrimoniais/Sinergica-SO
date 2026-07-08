import { supabase } from "../../../lib/supabase-client";
import type {
  CriarEspecialistaInput,
  CriarLicaoInput,
  OperacaoGateway,
} from "../application/operacao-gateway";
import type { EspecialistaItem, LicaoItem } from "../domain/operacao";

interface LicaoRow {
  id: string;
  persona_id: string;
  contexto: string;
  resposta_errada: string;
  resposta_certa: string;
  ativo: boolean;
}

interface EspecialistaRow {
  id: string;
  persona_id: string;
  nome: string;
  quando_chamar: string;
  ativo: boolean;
}

function mapLicao(row: LicaoRow): LicaoItem {
  return {
    id: row.id,
    personaId: row.persona_id,
    contexto: row.contexto,
    respostaErrada: row.resposta_errada,
    respostaCerta: row.resposta_certa,
    ativo: row.ativo,
  };
}

function mapEspecialista(row: EspecialistaRow): EspecialistaItem {
  return {
    id: row.id,
    personaId: row.persona_id,
    nome: row.nome,
    quandoChamar: row.quando_chamar,
    ativo: row.ativo,
  };
}

export const supabaseOperacaoAdapter: OperacaoGateway = {
  async listarLicoes(personaId: string) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("persona_licoes")
      .select("id,persona_id,contexto,resposta_errada,resposta_certa,ativo")
      .eq("persona_id", personaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as LicaoRow[]).map(mapLicao);
  },

  async criarLicao(input: CriarLicaoInput) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("persona_licoes")
      .insert({
        persona_id: input.personaId,
        contexto: input.contexto,
        resposta_errada: input.respostaErrada,
        resposta_certa: input.respostaCerta,
        created_by: input.userId,
      })
      .select("id,persona_id,contexto,resposta_errada,resposta_certa,ativo")
      .single();
    if (error) throw error;
    return mapLicao(data as LicaoRow);
  },

  async desativarLicao(id: string) {
    const { error } = await supabase
      .schema("atendimento")
      .from("persona_licoes")
      .update({ ativo: false })
      .eq("id", id);
    if (error) throw error;
  },

  async listarEspecialistas(personaId: string) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("persona_especialistas")
      .select("id,persona_id,nome,quando_chamar,ativo")
      .eq("persona_id", personaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as EspecialistaRow[]).map(mapEspecialista);
  },

  async criarEspecialista(input: CriarEspecialistaInput) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("persona_especialistas")
      .insert({
        persona_id: input.personaId,
        nome: input.nome,
        quando_chamar: input.quandoChamar,
        created_by: input.userId,
      })
      .select("id,persona_id,nome,quando_chamar,ativo")
      .single();
    if (error) throw error;
    return mapEspecialista(data as EspecialistaRow);
  },

  async desativarEspecialista(id: string) {
    const { error } = await supabase
      .schema("atendimento")
      .from("persona_especialistas")
      .update({ ativo: false })
      .eq("id", id);
    if (error) throw error;
  },
};
