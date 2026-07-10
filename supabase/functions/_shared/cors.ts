// _shared/cors.ts — CORS para Edge Functions. Vale para os dois perfis.
// Em produção, FIXE o domínio. Lista vinda de env (CORS_ALLOWED_ORIGINS), nunca "*".
const allowed = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim());

export function corsHeaders(origin: string | null): Record<string, string> {
  const bateAllowlist = origin != null && allowed.includes(origin);
  // E01-S48: sem isso, um Origin fora da allowlist (ex.: domínio de produção esquecido em
  // CORS_ALLOWED_ORIGINS) falha silencioso — o browser bloqueia a resposta e o usuário vê
  // "Failed to send a request to the Edge Function" sem nenhum rastro nos logs da function.
  if (origin != null && !bateAllowlist) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        nivel: "warn",
        msg: "Origin fora de CORS_ALLOWED_ORIGINS",
        origin,
      }),
    );
  }
  const allow = bateAllowlist ? (origin as string) : (allowed[0] ?? "");
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
