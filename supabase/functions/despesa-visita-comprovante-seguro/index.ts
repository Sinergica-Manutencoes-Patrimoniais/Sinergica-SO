import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { criarHandler } from "../financeiro-comprovante-seguro/handler.ts";
import { caminhoLegado } from "./seletor-legado.ts";
import { criarLeituraLimitadaStorage } from "../pcm-comprovante-ingestao/storage-limitado.ts";

// O handler comum usa o campo lancamentoId; nesta rota ele representa despesaId.
// Não implantar até revisão e liberação coordenada de RPC e Storage.
const url = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const privilegiado = () => createClient(url, getSupabaseServiceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});
serve(criarHandler({
  cors: corsHeaders,
  autenticar: async (req) => (await requireAuth(req)).userId,
  limitar: async (usuario) => {
    const { data, error } = await privilegiado().schema("atendimento").rpc("fn_consumir_rate_limit_webhook", {
      p_chave: `comprovante-despesa:${usuario}`, p_limite: 60, p_janela_segundos: 60,
    });
    if (error || typeof data !== "boolean") throw new Error("Limite indisponível");
    return data;
  },
  resolver: async (req, despesaId) => {
    if (Deno.env.get("SSO_COMPROVANTE_LEITURA_UNIFICADA_HABILITADA") === "true") {
      const usuario = (await requireAuth(req)).userId;
      const { data, error } = await privilegiado().schema("pcm").rpc("sso_comprovante_unificado_servico", { p_usuario_id: usuario, p_despesa_id: despesaId });
      if (error?.code === "42501") return null;
      if (error) throw error;
      return caminhoLegado(data, despesaId);
    }
    const cliente = createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
      auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await cliente.schema("pcm").rpc("sso_comprovante_despesa_autorizado", { p_despesa_id: despesaId });
    if (error?.code === "42501") return null;
    if (error || typeof data !== "string" || !data) throw new Error("Consulta indisponível");
    return data;
  },
  baixar: async (caminho) => {
    const bytes = await criarLeituraLimitadaStorage(url, getSupabaseServiceKey(), fetch, true)(caminho);
    return new Blob([Uint8Array.from(bytes).buffer]);
  },
}));
