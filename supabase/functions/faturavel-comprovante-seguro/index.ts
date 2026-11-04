import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { criarHandler } from "../financeiro-comprovante-seguro/handler.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const privilegiado = () => createClient(url, getSupabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
async function identidade(req: Request): Promise<{ usuario: string; papel: string }> {
  const usuario = (await requireAuth(req)).userId;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1]; if (!payload) throw new Error("Token inválido");
  const normalizado = payload.replace(/-/g, "+").replace(/_/g, "/");
  const claims = JSON.parse(atob(normalizado.padEnd(Math.ceil(normalizado.length / 4) * 4, "=")));
  if (typeof claims.user_role !== "string") throw new Error("Papel ausente");
  return { usuario, papel: claims.user_role };
}
// Não implantar antes de revisão de Storage, permissões e testes integrados.
serve(criarHandler({
  cors: corsHeaders,
  autenticar: async (req) => (await requireAuth(req)).userId,
  limitar: async (usuario) => {
    const { data, error } = await privilegiado().schema("atendimento").rpc("fn_consumir_rate_limit_webhook", {
      p_chave: "faturavel-comprovante:" + usuario, p_limite: 60, p_janela_segundos: 60 });
    if (error || typeof data !== "boolean") throw new Error("Limite indisponível"); return data;
  },
  resolver: async (req, id) => {
    const { usuario, papel } = await identidade(req);
    const { data, error } = await privilegiado().schema("financeiro").rpc("sso_resolver_anexo_faturavel_servico", { p_usuario_id: usuario, p_anexo_id: id, p_papel: papel });
    if (error?.code === "42501") return null;
    if (error || typeof data !== "string" || !data) throw new Error("Consulta indisponível"); return data;
  },
  baixar: async (caminho) => { const { data, error } = await privilegiado().storage.from("sso-despesas-visita").download(caminho);
    if (error || !data) throw new Error("Arquivo indisponível"); return data; },
  auditar: async (req, requestId, id) => {
    const { usuario, papel } = await identidade(req);
    const { data, error } = await privilegiado().schema("financeiro").rpc("sso_auditar_anexo_faturavel_servico", {
      p_usuario_id: usuario, p_papel: papel, p_anexo_id: id, p_request_id: requestId });
    if (error?.code === "42501") return false;
    if (error || data !== true) throw new Error("Auditoria indisponível"); return true;
  },
}));
