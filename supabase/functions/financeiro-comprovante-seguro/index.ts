import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { criarHandler, criarTransporteStorage } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const privilegiado = () => createClient(url, getSupabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } });

serve(criarHandler({
  cors: corsHeaders,
  autenticar: async (req) => (await requireAuth(req)).userId,
  limitar: async (usuario) => {
    const { data, error } = await privilegiado().schema("atendimento").rpc("fn_consumir_rate_limit_webhook", {
      p_chave: `comprovante:${usuario}`, p_limite: 60, p_janela_segundos: 60,
    });
    if (error || typeof data !== "boolean") throw new Error("Limite indisponível");
    return data;
  },
  resolver: async (req, lancamentoId) => {
    const cliente = createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
      auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await cliente.schema("financeiro").rpc("sso_comprovante_autorizado", { p_lancamento_id: lancamentoId });
    if (error?.code === "42501") return null;
    if (error || typeof data !== "string" || !data) throw new Error("Consulta indisponível");
    return data;
  },
  baixar: async (caminho) => {
    return await criarTransporteStorage(url, getSupabaseServiceKey())(caminho);
  },
}));
