import { supabase } from "../../../lib/supabase-client";
import type { PriorizacaoGutdGateway } from "../application/priorizacao-gutd-gateway";
import { PESOS_GUTD_PADRAO } from "../domain/priorizacao-backlog";
import type { PesosGutd } from "../domain/priorizacao-backlog";

export const supabasePriorizacaoGutdAdapter: PriorizacaoGutdGateway = {
  async obterPesos(): Promise<PesosGutd> {
    const { data, error } = await supabase
      .schema("config")
      .from("priorizacao_gutd")
      .select("peso_gravidade,peso_urgencia,peso_tendencia,peso_dor_cliente")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return PESOS_GUTD_PADRAO;
    return {
      gravidade: data.peso_gravidade,
      urgencia: data.peso_urgencia,
      tendencia: data.peso_tendencia,
      dorCliente: data.peso_dor_cliente,
    };
  },

  async salvarPesos(pesos: PesosGutd, updatedBy: string): Promise<void> {
    const { error } = await supabase
      .schema("config")
      .from("priorizacao_gutd")
      .update({
        peso_gravidade: pesos.gravidade,
        peso_urgencia: pesos.urgencia,
        peso_tendencia: pesos.tendencia,
        peso_dor_cliente: pesos.dorCliente,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      })
      .eq("id", 1);
    if (error) throw error;
  },
};
