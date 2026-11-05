import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cliente = () => createClient(url, getSupabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
async function identidade(req: Request) {
  const { userId } = await requireAuth(req);
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const parte = token?.split(".")[1]; if (!parte) throw new Error("token_invalido");
  const base64 = parte.replace(/-/g, "+").replace(/_/g, "/");
  const claims: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
  if (!claims || typeof claims !== "object" || !("sub" in claims) || claims.sub !== userId || !("user_role" in claims) || typeof claims.user_role !== "string" || !claims.user_role) throw new Error("claims_invalidas");
  return { userId, papel: claims.user_role };
}
import { criarHandler } from "./handler.ts";
serve(criarHandler({ corsHeaders, identidade, habilitada: () => Deno.env.get("SSO_FOTO_CADASTRAL_GRUPO_ENABLED"), cliente, chave: getSupabaseServiceKey, url, fetch }));
