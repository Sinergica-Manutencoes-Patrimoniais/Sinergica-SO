import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey } from "../_shared/auth.ts";
import { criarComposicaoOrigemCampo } from "../_shared/auvo/composicao-origem-campo.ts";

// A impressão digital fixa os campos completos aprovados para este ambiente.
// O valor deve vir de uma revisão independente; habilitar o contrato no banco não é essa revisão.
function canonico(valor: unknown): string {
  if (valor === null || typeof valor === "string" || typeof valor === "boolean" || typeof valor === "number") {
    if (typeof valor === "number" && !Number.isFinite(valor)) throw new Error("Contrato inválido.");
    return JSON.stringify(valor)!;
  }
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (typeof valor !== "object") throw new Error("Contrato inválido.");
  const objeto = valor as Record<string, unknown>;
  return `{${Object.keys(objeto).sort().map((chave) => `${JSON.stringify(chave)}:${canonico(objeto[chave])}`).join(",")}}`;
}

async function comprovarContrato(contrato: Readonly<Record<string, unknown>>): Promise<boolean> {
  const esperado = Deno.env.get("SSO_ORIGEM_CONTRATO_APROVADO_SHA256") ?? "";
  if (!/^[a-f0-9]{64}$/.test(esperado)) return false;
  const bytes = new TextEncoder().encode(canonico(contrato));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const calculado = Array.from(digest, (parte) => parte.toString(16).padStart(2, "0")).join("");
  return calculado === esperado;
}

Deno.serve(async (req) => {
  if (Deno.env.get("SSO_ORIGEM_CAMPO_PROCESSAR_ENABLED") !== "true") {
    return new Response(JSON.stringify({ erro: "indisponivel" }), {
      status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    if (!url) throw new Error("Configuração indisponível.");
    const banco = createClient(url, getSupabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const executar = criarComposicaoOrigemCampo({
      habilitado: () => Deno.env.get("SSO_ORIGEM_CAMPO_PROCESSAR_ENABLED") === "true",
      banco: banco as unknown as Parameters<typeof criarComposicaoOrigemCampo>[0]["banco"],
      comprovarContrato,
      aplicarEventos: () => Deno.env.get("SSO_ORIGEM_CAMPO_APLICAR_EVENTOS_ENABLED") === "true",
      agora: () => performance.now(),
    });
    return await executar(req);
  } catch {
    return new Response(JSON.stringify({ erro: "indisponivel" }), {
      status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
});
