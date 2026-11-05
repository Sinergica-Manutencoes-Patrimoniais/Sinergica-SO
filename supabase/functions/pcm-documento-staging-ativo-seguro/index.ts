import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
const url = Deno.env.get("SUPABASE_URL") ?? "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const servico = () => createClient(url, getSupabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
async function baixar(caminho: string): Promise<Uint8Array | null> {
  const partes = caminho.split("/");
  if (partes.some(p => !p || p === "." || p === ".." || p.includes("\\"))) throw new Error("Caminho inválido");
  const chave = getSupabaseServiceKey();
  const endpoint = `${url.replace(/\/+$/, "")}/storage/v1/object/authenticated/sso-levantamento-documentos/${partes.map(encodeURIComponent).join("/")}`;
  const resposta = await fetch(endpoint, { headers: { Authorization: `Bearer ${chave}`, apikey: chave }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!resposta.ok || !resposta.body) { void resposta.body?.cancel().catch(() => {}); throw new Error("Storage indisponível"); }
  const leitor = resposta.body.getReader(); const blocos: Uint8Array[] = []; let total = 0;
  try { for (;;) { const { done, value } = await leitor.read(); if (done) break; total += value.byteLength; if (total > 10_485_760) { void leitor.cancel().catch(() => {}); return null; } blocos.push(new Uint8Array(value)); } }
  finally { try { leitor.releaseLock(); } catch { /* Cancelamento pode estar em curso. */ } }
  const bytes = new Uint8Array(total); let pos = 0; for (const bloco of blocos) { bytes.set(bloco, pos); pos += bloco.length; } return bytes;
}
serve(async req => {
  const cors = corsHeaders(req.headers.get("origin"));
  const falha = (status: number) => new Response(JSON.stringify({ title: "Documento indisponível", status }), { status, headers: { ...cors, "Content-Type": "application/problem+json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return falha(405);
  let usuario: string; try { usuario = (await requireAuth(req)).userId; } catch { return falha(401); }
  if (Deno.env.get("SSO_DOCUMENTO_ATIVO_MEDIADO_ENABLED") !== "true") return falha(404);
  try {
    const limite = await servico().schema("atendimento").rpc("fn_consumir_rate_limit_webhook", { p_chave: `documento-staging-ativo:${usuario}`, p_limite: 60, p_janela_segundos: 60 });
    if (limite.error || typeof limite.data !== "boolean") return falha(503); if (!limite.data) return falha(429);
    if (!req.body) return falha(422);
    const leitor = req.body.getReader(); const dec = new TextDecoder("utf-8", { fatal: true }); let texto = ""; let tamanho = 0;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const prazo = new Promise<never>((_, rejeitar) => { temporizador = setTimeout(() => { void leitor.cancel().catch(() => {}); rejeitar(new Error("Prazo excedido")); }, 10_000); });
    try { for (;;) { const { done, value } = await Promise.race([leitor.read(), prazo]); if (done) break; tamanho += value.byteLength; if (tamanho > 4096) { void leitor.cancel().catch(() => {}); return falha(413); } texto += dec.decode(value, { stream: true }); } }
    finally { if (temporizador !== undefined) clearTimeout(temporizador); try { leitor.releaseLock(); } catch { /* Cancelamento pode estar em curso. */ } }
    let dados: unknown; try { dados = JSON.parse(texto + dec.decode()); } catch { return falha(422); }
    if (!dados || typeof dados !== "object" || Array.isArray(dados) || Object.keys(dados).length !== 1 || !("vinculoId" in dados) || typeof dados.vinculoId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dados.vinculoId)) return falha(422);
    const vinculoId = dados.vinculoId;
    const cliente = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("authorization") ?? "" } }, auth: { persistSession: false, autoRefreshToken: false } });
    const resolver = async () => {
      const autorizacao = await cliente.schema("pcm").rpc("sso_autorizar_documento_ativo_mediado", { p_ator_id: usuario, p_vinculo_id: vinculoId });
      if (autorizacao.error?.code === "42501") return null;
      if (autorizacao.error || !autorizacao.data || typeof autorizacao.data !== "object") throw new Error("Autorização indisponível");
      const identidadeAutorizada = autorizacao.data as Record<string, unknown>;
      const local = await servico().schema("pcm").rpc("sso_localizar_documento_ativo_servico", { p_vinculo_id: vinculoId });
      if (local.error || !Array.isArray(local.data) || local.data.length !== 1) throw new Error("Localização indisponível");
      const item = local.data[0];
      if (!item || typeof item.caminho !== "string" || !item.caminho || typeof item.objeto_id !== "string" || typeof item.documento_id !== "string" || typeof item.objeto_atualizado_em !== "string" || !Number.isFinite(Date.parse(item.objeto_atualizado_em))) throw new Error("Localização inválida");
      if (identidadeAutorizada.objetoId !== item.objeto_id || identidadeAutorizada.documentoId !== item.documento_id || identidadeAutorizada.clienteId !== item.cliente_id || typeof identidadeAutorizada.objetoAtualizadoEm !== "string" || identidadeAutorizada.objetoAtualizadoEm !== item.objeto_atualizado_em) throw new Error("Identidade divergente");
      return { caminho: item.caminho, identidade: JSON.stringify([item.caminho, item.objeto_id, item.documento_id, item.cliente_id, item.objeto_atualizado_em]) };
    };
    const origem = await resolver(); if (!origem) return falha(404);
    const bytes = await baixar(origem.caminho); if (!bytes) return falha(413);
    if (bytes.length < 5 || ![37,80,68,70,45].every((v, i) => bytes[i] === v)) return falha(415);
    try { if ((await requireAuth(req)).userId !== usuario) return falha(401); } catch { return falha(401); }
    const final = await resolver(); if (!final || final.identidade !== origem.identidade) return falha(404);
    try { if ((await requireAuth(req)).userId !== usuario) return falha(401); } catch { return falha(401); }
    return new Response(bytes, { headers: { ...cors, "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=\"documento.pdf\"", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch { return falha(503); }
});
