import { supabase } from "../../../lib/supabase-client";
import type {
  Integracao,
  IntegracoesGateway,
  SalvarIntegracaoInput,
} from "../application/integracoes-gateway";

interface IntegracaoRow {
  id: string;
  chave: string;
  provedor: string | null;
  ativo: boolean;
  config_publico: Record<string, unknown> | null;
}

const COLS = "id,chave,provedor,ativo,config_publico" as const;

async function comTemSegredo(rows: IntegracaoRow[]): Promise<Integracao[]> {
  const resultados = await Promise.all(
    rows.map(async (row) => {
      const { data, error } = await supabase
        .schema("config")
        .rpc("fn_integracao_tem_segredo", { p_chave: row.chave });
      if (error) throw error;
      return {
        id: row.id,
        chave: row.chave,
        provedor: row.provedor,
        ativo: row.ativo,
        configPublico: row.config_publico ?? {},
        temSegredo: Boolean(data),
      };
    }),
  );
  return resultados;
}

export const supabaseIntegracoesAdapter: IntegracoesGateway = {
  async listar(): Promise<Integracao[]> {
    const { data, error } = await supabase.schema("config").from("integracoes").select(COLS);
    if (error) throw error;
    return comTemSegredo((data ?? []) as IntegracaoRow[]);
  },

  async salvarMetadado(input: SalvarIntegracaoInput): Promise<Integracao> {
    const { data, error } = await supabase
      .schema("config")
      .from("integracoes")
      .upsert(
        {
          chave: input.chave,
          provedor: input.provedor,
          ativo: input.ativo,
          config_publico: input.configPublico,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "chave" },
      )
      .select(COLS)
      .single();
    if (error) throw error;
    const [integracao] = await comTemSegredo([data as IntegracaoRow]);
    if (!integracao) throw new Error("Integração salva não encontrada.");
    return integracao;
  },

  async definirSegredo(chave: string, valor: string): Promise<void> {
    const { error } = await supabase
      .schema("config")
      .rpc("fn_definir_segredo_integracao", { p_chave: chave, p_valor: valor });
    if (error) throw error;
    await supabase
      .schema("config")
      .from("integracoes")
      .update({ configurado_em: new Date().toISOString() })
      .eq("chave", chave);
  },
};
