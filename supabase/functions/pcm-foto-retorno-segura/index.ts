import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { criarHandler } from "../financeiro-comprovante-seguro/handler.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const privilegiado = () => createClient(url, getSupabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } });

async function identidadeValidada(req: Request): Promise<{ userId: string; userRole: string }> {
  const { userId } = await requireAuth(req);
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) throw new Error("Token ausente");
  const parte = token.split(".")[1]; if (!parte) throw new Error("Token inválido");
  const base64 = parte.replace(/-/g, "+").replace(/_/g, "/");
  const claims: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
  if (!claims || typeof claims !== "object" || !("sub" in claims) || claims.sub !== userId || !("user_role" in claims) || typeof claims.user_role !== "string" || !claims.user_role) throw new Error("Claims inválidos");
  return { userId, userRole: claims.user_role };
}

// Não implantar antes da revisão do resolver, Storage e concessões.
serve(criarHandler({
  cors: corsHeaders,
  autenticar: async (req) => (await requireAuth(req)).userId,
  limitar: async (usuario) => {
    const { data, error } = await privilegiado().schema("atendimento").rpc("fn_consumir_rate_limit_webhook", { p_chave: "pcm-foto-retorno-segura:" + usuario, p_limite: 60, p_janela_segundos: 60 });
    if (error || typeof data !== "boolean") throw new Error("Limite indisponível"); return data;
  },
  resolver: async (req, id) => {
    const { userId, userRole } = await identidadeValidada(req);
    const { data, error } = await privilegiado().schema("pcm").rpc("sso_foto_retorno_servico", { p_anexo_id: id, p_usuario_id: userId, p_user_role: userRole });
    if (error?.code === "42501") return null;
    if (error || typeof data !== "string" || !data) throw new Error("Consulta indisponível"); return data;
  },
  baixar: async (caminho) => { const { data, error } = await privilegiado().storage.from("os-anexos").download(caminho); if (error || !data) throw new Error("Arquivo indisponível"); return data; },
}));
