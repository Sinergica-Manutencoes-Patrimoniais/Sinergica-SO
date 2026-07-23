import { supabase } from "../../../lib/supabase-client";
import type { LocalizacaoAuvoGateway } from "../application/localizacao-auvo-gateway";
import {
  PREFERENCIA_LOCALIZACAO_PADRAO,
  type PreferenciaLocalizacaoAuvo,
} from "../domain/localizacao-auvo";

export const supabaseLocalizacaoAuvoAdapter: LocalizacaoAuvoGateway = {
  async obterPreferencia(): Promise<PreferenciaLocalizacaoAuvo> {
    const { data, error } = await supabase
      .schema("config")
      .from("preferencia_localizacao_auvo")
      .select("separador,ordem")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return PREFERENCIA_LOCALIZACAO_PADRAO;
    return { separador: data.separador, ordem: data.ordem };
  },

  async salvarPreferencia(
    preferencia: PreferenciaLocalizacaoAuvo,
    updatedBy: string,
  ): Promise<void> {
    const { error } = await supabase
      .schema("config")
      .from("preferencia_localizacao_auvo")
      .update({
        separador: preferencia.separador,
        ordem: preferencia.ordem,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      })
      .eq("id", 1);
    if (error) throw error;
  },
};
