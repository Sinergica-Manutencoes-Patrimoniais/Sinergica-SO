import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { processarFotoCadastral } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
async function identidade(req: Request) {
  const { userId } = await requireAuth(req); const parte = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1]?.split(".")[1];
  if (!parte) throw new Error("token_invalido"); const b64 = parte.replace(/-/g, "+").replace(/_/g, "/");
  const claims: unknown = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "=")));
  if (!claims || typeof claims !== "object" || !("sub" in claims) || claims.sub !== userId || !("user_role" in claims) || typeof claims.user_role !== "string" || !claims.user_role) throw new Error("claims_invalidas");
  return { userId, papel: claims.user_role };
}
serve((req) => processarFotoCadastral(req, {
  url,
  identidade,
  corsHeaders,
  enabled: () => Deno.env.get("SSO_INGESTAO_FOTO_CADASTRAL_GRUPO_ENABLED"),
  servico: () => createClient(url, getSupabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } }),
  chave: getSupabaseServiceKey,
  fetch,
}));
