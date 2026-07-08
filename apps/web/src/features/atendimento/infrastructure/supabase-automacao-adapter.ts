import { supabase } from "../../../lib/supabase-client";
import type { AutomacaoGateway, CriarIgAutomationInput } from "../application/automacao-gateway";
import type { CanalOptOut, IgAutomationItem, OptOutItem } from "../domain/automacao";

interface IgAutomationRow {
  id: string;
  canal_id: string | null;
  nome: string;
  palavras_gatilho: string[];
  resposta_dm: string;
  ativo: boolean;
}

interface OptOutRow {
  id: string;
  contato_id: string;
  canal: CanalOptOut;
  motivo: string | null;
}

function mapIgAutomation(row: IgAutomationRow): IgAutomationItem {
  return {
    id: row.id,
    canalId: row.canal_id,
    nome: row.nome,
    palavrasGatilho: row.palavras_gatilho,
    respostaDm: row.resposta_dm,
    ativo: row.ativo,
  };
}

function mapOptOut(row: OptOutRow): OptOutItem {
  return {
    id: row.id,
    contatoId: row.contato_id,
    // Sem join cross-schema (atendimento -> relacionamento) via PostgREST embed simples — nome
    // do contato fica de fora nesta versão; mostrar o id é honesto em vez de arriscar um embed
    // que pode não resolver. Evolução futura: view/RPC dedicada se a UI precisar do nome.
    contatoNome: null,
    canal: row.canal,
    motivo: row.motivo,
  };
}

export const supabaseAutomacaoAdapter: AutomacaoGateway = {
  async listarIgAutomations() {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("ig_comment_automations")
      .select("id,canal_id,nome,palavras_gatilho,resposta_dm,ativo")
      .order("nome");
    if (error) throw error;
    return ((data ?? []) as IgAutomationRow[]).map(mapIgAutomation);
  },

  async criarIgAutomation(input: CriarIgAutomationInput) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("ig_comment_automations")
      .insert({
        canal_id: input.canalId,
        nome: input.nome,
        palavras_gatilho: input.palavrasGatilho,
        resposta_dm: input.respostaDm,
        created_by: input.userId,
      })
      .select("id,canal_id,nome,palavras_gatilho,resposta_dm,ativo")
      .single();
    if (error) throw error;
    return mapIgAutomation(data as IgAutomationRow);
  },

  async desativarIgAutomation(id: string) {
    const { error } = await supabase
      .schema("atendimento")
      .from("ig_comment_automations")
      .update({ ativo: false })
      .eq("id", id);
    if (error) throw error;
  },

  async listarOptOuts() {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("opt_outs")
      .select("id,contato_id,canal,motivo")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as OptOutRow[]).map(mapOptOut);
  },

  async removerOptOut(id: string) {
    const { error } = await supabase.schema("atendimento").from("opt_outs").delete().eq("id", id);
    if (error) throw error;
  },

  async criarOptOut(input) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("opt_outs")
      .insert({
        contato_id: input.contatoId,
        canal: input.canal,
        motivo: input.motivo,
        created_by: input.userId,
      })
      .select("id,contato_id,canal,motivo")
      .single();
    if (error) throw error;
    return mapOptOut(data as OptOutRow);
  },
};
