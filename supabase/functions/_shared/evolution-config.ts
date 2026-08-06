import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey } from "./auth.ts";

export interface EvolutionConfiguracao {
  baseUrl: string;
  apiKey: string;
}

/** E02-S27: credencial configurada pelo SO no Vault, com fallback transitório para secrets antigos.
 * Nunca retorna ao browser e nunca inclui a chave numa mensagem de erro. */
export async function obterConfiguracaoEvolution(): Promise<EvolutionConfiguracao | null> {
  const fallbackUrl = (Deno.env.get("EVOLUTION_API_URL") ?? "").replace(/\/+$/, "");
  const fallbackKey = Deno.env.get("EVOLUTION_API_KEY")?.trim() ?? "";
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", getSupabaseServiceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [{ data: integracao }, { data: segredo, error }] = await Promise.all([
      db.schema("config").from("integracoes").select("config_publico").eq("chave", "evolution").maybeSingle(),
      db.schema("config").rpc("fn_obter_segredo_integracao_interno", { p_chave: "evolution_api_key" }),
    ]);
    if (error) throw error;
    const config = (integracao?.config_publico ?? {}) as Record<string, unknown>;
    const baseUrl = typeof config.api_url === "string" ? config.api_url.replace(/\/+$/, "") : fallbackUrl;
    const apiKey = typeof segredo === "string" && segredo.trim() ? segredo.trim() : fallbackKey;
    return baseUrl && apiKey ? { baseUrl, apiKey } : null;
  } catch {
    return fallbackUrl && fallbackKey ? { baseUrl: fallbackUrl, apiKey: fallbackKey } : null;
  }
}
