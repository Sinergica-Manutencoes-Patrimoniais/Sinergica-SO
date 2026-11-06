import { supabase } from "../../../lib/supabase-client";
import type { PropostasSemCustosGateway } from "../application/propostas-sem-custos-queries";

export const supabasePropostasSemCustosAdapter: PropostasSemCustosGateway = {
  async listar(oportunidadeId) {
    const { data, error } = await supabase
      .schema("comercial")
      .from("propostas_sem_custos")
      .select("id,tipo,status,escopo,preco_centavos,versao_atual")
      .eq("oportunidade_id", oportunidadeId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id as string,
      tipo: row.tipo as string,
      status: row.status as string,
      escopo: row.escopo as string | null,
      precoCentavos: row.preco_centavos as number,
      versao: row.versao_atual as number,
    }));
  },
};
