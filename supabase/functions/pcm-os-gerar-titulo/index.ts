// pcm-os-gerar-titulo — E01-S81 AC-2/AC-4. Gera um título declarativo curto pra OS a partir da
// descrição, via OpenRouter (credencial no Vault, config.integracoes chave 'openrouter'). Chamada
// pelo botão "Gerar título" no form de abertura/edição de OS — usuário com pcm:leitura basta (é
// um auxílio de redação, não uma escrita).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireAuth } from "../_shared/auth.ts";
import { gerarTituloOsViaOpenRouter, OpenRouterApiError } from "../_shared/openrouter.ts";
import { sanearTituloGerado } from "../_shared/titulo-os.ts";

const FN = "pcm-os-gerar-titulo";
const InputSchema = z.object({ descricao: z.string().min(1) });

function claimsFrom(req: Request): { user_role?: string; user_modulos?: Record<string, string> } {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const payload = token.split(".")[1];
  if (!payload) return {};
  try {
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });
  const reqId = crypto.randomUUID().slice(0, 8);

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    await requireAuth(req);
    const claims = claimsFrom(req);
    if (claims.user_role !== "superadmin" && !claims.user_modulos?.pcm) {
      throw new HttpError(403, "Sem acesso ao PCM");
    }
    const { descricao } = InputSchema.parse(await req.json());

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    // biome-ignore lint/suspicious/noExplicitAny: cliente supabase-js sem tipos gerados no repo (schemas não-public)
    const db: any = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: integracao } = await db.schema("config").from("integracoes").select("ativo,config_publico").eq("chave", "openrouter").maybeSingle();
    if (!integracao?.ativo) throw new HttpError(422, "IA de título não está ativa (Configurações > IA).");

    const { data: apiKey } = await db.schema("config").rpc("fn_obter_segredo_integracao_interno", { p_chave: "openrouter_api_key" });
    if (!apiKey) throw new HttpError(422, "Chave do OpenRouter não configurada (Configurações > IA).");

    const modelo = (integracao.config_publico?.modelo as string | undefined) ?? "openai/gpt-4o-mini";
    const bruto = await gerarTituloOsViaOpenRouter(apiKey, modelo, descricao);
    const titulo = sanearTituloGerado(bruto);

    console.log(JSON.stringify({ ts: new Date().toISOString(), nivel: "info", fn: FN, reqId, msg: "título gerado" }));
    return json(200, { titulo }, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof OpenRouterApiError) return problem(502, `IA indisponível: ${e.message}`, reqId, cors);
    console.error(JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors);
  }
});

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}

function problem(status: number, detail: string, reqId: string, cors: Record<string, string>): Response {
  const titles: Record<number, string> = { 401: "Unauthorized", 403: "Forbidden", 405: "Method Not Allowed", 422: "Unprocessable Entity", 500: "Internal Server Error", 502: "Bad Gateway" };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/problem+json", ...cors } });
}
