import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { criarHandler } from "../financeiro-comprovante-seguro/handler.ts";
import { criarDownloadAnexoPortal } from "../portal-anexo-os-seguro/storage.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const privilegiado = () => createClient(url, getSupabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } });

// O identificador do handler comum é a nota; não implantar antes da revisão e dos testes.
serve(criarHandler({
  cors: corsHeaders,
  autenticar: async (req) => (await requireAuth(req)).userId,
  limitar: async (usuario) => {
    const { data, error } = await privilegiado().schema("atendimento").rpc("fn_consumir_rate_limit_webhook", {
      p_chave: "portal-anexo-proprio-seguro:" + usuario, p_limite: 60, p_janela_segundos: 60,
    });
    if (error || typeof data !== "boolean") throw new Error("Limite indisponível");
    return data;
  },
  resolver: async (req, id) => {
    if (Deno.env.get("SSO_PORTAL_ANEXO_PROPRIO_MEDIADO_ENABLED") !== "true") throw new Error("Rota indisponível");
    const usuario = (await requireAuth(req)).userId;
    const { data, error } = await privilegiado().schema("pcm").rpc("sso_portal_anexo_proprio_servico", { p_usuario_id: usuario, p_nota_id: id });
    if (error?.code === "42501") return null;
    if (error || typeof data !== "string" || !data) throw new Error("Consulta indisponível");
    return data;
  },
  baixar: async (caminho) => {
    return await criarDownloadAnexoPortal(url, getSupabaseServiceKey())(caminho);
  },
}));
