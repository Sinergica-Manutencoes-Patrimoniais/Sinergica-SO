import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { criarLeitura } from "../pcm-foto-ingestao-segura/leitura.ts";
import { criarAdaptadorLeitura } from "../pcm-foto-ingestao-segura/adapter-leitura.ts";
import { cabecalhosFotos } from "../pcm-foto-ingestao-segura/cors.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
async function baixarLimitado(nome: string): Promise<Uint8Array> {
  const partes = nome.split("/");
  if (partes.some((p) => !p || p === "." || p === ".." || p.includes("\\"))) throw new Error("caminho_invalido");
  const chave = getSupabaseServiceKey();
  const endereco = `${url.replace(/\/+$/, "")}/storage/v1/object/authenticated/sso-levantamento-fotos/${partes.map(encodeURIComponent).join("/")}`;
  const resposta = await fetch(endereco, { headers: { Authorization: `Bearer ${chave}`, apikey: chave }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!resposta.ok || !resposta.body) { void resposta.body?.cancel().catch(() => {}); throw new Error("storage_indisponivel"); }
  const leitor = resposta.body.getReader();
  const blocos: Uint8Array[] = []; let tamanho = 0;
  try {
    for (;;) {
      const { done, value } = await leitor.read(); if (done) break;
      tamanho += value.byteLength;
      if (tamanho > 10_485_760) { void leitor.cancel().catch(() => {}); throw new Error("arquivo_excessivo"); }
      blocos.push(new Uint8Array(value));
    }
  } finally { try { leitor.releaseLock(); } catch { /* Cancelamento ainda pode estar em voo. */ } }
  const bytes = new Uint8Array(tamanho); let posicao = 0;
  for (const bloco of blocos) { bytes.set(bloco, posicao); posicao += bloco.length; }
  return bytes;
}

serve(async (req) => {
  const cors = cabecalhosFotos(corsHeaders(req.headers.get("origin")));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const cliente = createClient(url, getSupabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const handler = criarLeitura(criarAdaptadorLeitura({
    autenticar: async (r) => ({ usuario: (await requireAuth(r)).userId }),
    habilitado: async () => Deno.env.get("SSO_FOTO_VERIFICADA_GRUPO_ENABLED") === "true",
    limitar: async ({ usuario }) => {
      const { data, error } = await cliente.schema("atendimento").rpc("fn_consumir_rate_limit_webhook", { p_chave: `foto-verificada-grupo:${usuario}`, p_limite: 60, p_janela_segundos: 60 });
      if (error || typeof data !== "boolean") throw new Error("limite_indisponivel");
      return data;
    },
    resolver: async (usuario, vinculoId) => {
      const { data, error } = await cliente.schema("pcm").rpc("sso_resolver_foto_verificada_grupo_servico", { p_usuario_id: usuario, p_vinculo_id: vinculoId });
      if (error?.code === "42501") return null;
      if (error) throw error;
      return data;
    },
    download: baixarLimitado,
  }));
  const resposta = await handler(req); const headers = new Headers(resposta.headers);
  for (const [chave, valor] of Object.entries(cors)) headers.set(chave, valor);
  return new Response(resposta.body, { status: resposta.status, headers });
});
