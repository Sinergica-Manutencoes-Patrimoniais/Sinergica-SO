import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { criarHandler } from "./handler.ts";
import { criarLeituraLimitadaStorage } from "../pcm-comprovante-ingestao/storage-limitado.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const privilegiado = () => createClient(url, getSupabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
const cliente = (req: Request) => createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
  auth: { persistSession: false, autoRefreshToken: false } });

// Não implantar antes de revisão e concessão coordenada das RPCs.
serve(criarHandler({
  cors: corsHeaders,
  autenticar: async (req) => (await requireAuth(req)).userId,
  limitar: async (usuario) => {
    const { data, error } = await privilegiado().schema("atendimento").rpc("fn_consumir_rate_limit_webhook", {
      p_chave: `comprovante-historico:${usuario}`, p_limite: 60, p_janela_segundos: 60 });
    if (error || typeof data !== "boolean") throw new Error("Limite indisponível");
    return data;
  },
  resolver: async (req, despesaId, revisao) => {
    const { data, error } = await cliente(req).schema("pcm").rpc("sso_comprovante_despesa_revisao_autorizado", {
      p_despesa_id: despesaId, p_revisao: revisao });
    if (error?.code === "42501") return null;
    if (error || typeof data !== "string" || !data) throw new Error("Consulta indisponível");
    return data;
  },
  baixar: async (caminho) => {
    const bytes = await criarLeituraLimitadaStorage(url, getSupabaseServiceKey(), fetch, true)(caminho);
    return new Blob([Uint8Array.from(bytes).buffer]);
  },
  auditar: async (req, requestId, despesaId, revisao) => {
    const { data, error } = await cliente(req).schema("pcm").rpc("sso_auditar_download_despesa", {
      p_request_id: requestId, p_despesa_id: despesaId, p_revisao: revisao });
    if (error?.code === "42501") return false;
    if (error || data !== true) throw new Error("Auditoria indisponível");
    return true;
  },
}));
