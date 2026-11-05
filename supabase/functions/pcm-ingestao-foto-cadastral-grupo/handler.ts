import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Identidade = { userId: string; papel: string };
export type Dependencias = {
  url: string;
  identidade: (req: Request) => Promise<Identidade>;
  corsHeaders: (origin: string | null) => Record<string, string>;
  enabled: () => string | undefined;
  servico: () => SupabaseClient;
  chave: () => string;
  fetch: typeof fetch;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer)), (v) => v.toString(16).padStart(2, "0")).join("");
export async function processarFotoCadastral(req: Request, deps: Dependencias): Promise<Response> {

  const cors = { ...deps.corsHeaders(req.headers.get("origin")), "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-request-id, x-cliente-id, x-grupo-id" };
  const falha = (status: number) => new Response(JSON.stringify({ title: "Foto não confirmada", status }), { status, headers: { ...cors, "Content-Type": "application/problem+json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors }); if (req.method !== "POST") return falha(405);
  let usuario: Identidade; try { usuario = await deps.identidade(req); } catch { return falha(401); }
  try {
    if (deps.enabled() !== "true") return falha(503);
    const servico = deps.servico();
    const limite = await servico.schema("atendimento").rpc("fn_consumir_rate_limit_webhook", { p_chave: `foto-cadastral-ingestao:${usuario.userId}`, p_limite: 20, p_janela_segundos: 60 });
    if (limite.error || typeof limite.data !== "boolean") return falha(503); if (!limite.data) return falha(429);
    const requestId = req.headers.get("x-request-id") ?? "", clienteId = req.headers.get("x-cliente-id") ?? "", grupoId = req.headers.get("x-grupo-id") ?? "";
    if (![requestId, clienteId, grupoId].every((v) => uuid.test(v)) || !req.body) return falha(422);
    const leitor = req.body.getReader(), blocos: Uint8Array[] = []; let tamanho = 0, expirou = false;
    const timer = setTimeout(() => { expirou = true; void leitor.cancel().catch(() => {}); }, 30_000);
    try { for (;;) { const { done, value } = await leitor.read(); if (done) break; tamanho += value.byteLength; if (tamanho > 10_485_760) { void leitor.cancel().catch(() => {}); return falha(413); } blocos.push(value); } } finally { clearTimeout(timer); leitor.releaseLock(); }
    if (expirou) return falha(408); const bytes = new Uint8Array(tamanho); let pos = 0; for (const bloco of blocos) { bytes.set(bloco, pos); pos += bloco.length; }
    const jpeg = tamanho >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const png = tamanho >= 8 && [137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n);
    if (!jpeg && !png) return falha(415); const tipo = jpeg ? "image/jpeg" : "image/png", digest = await hash(bytes);
    const rpc = async (operacao: string, objeto: string | null = null) => {
      const { data, error } = await servico.schema("pcm").rpc("sso_ingestao_foto_cadastral_grupo_servico", { p_operacao: operacao, p_ator: usuario.userId, p_papel: usuario.papel, p_cliente: clienteId, p_grupo: grupoId, p_request: requestId, p_digest: digest, p_tipo: tipo, p_objeto: objeto });
      if (error?.code === "23505") throw new Error("conflito"); if (error) throw new Error("indisponivel"); return data;
    };
    const confirmarSessao = async () => { const atual = await deps.identidade(req); if (atual.userId !== usuario.userId || atual.papel !== usuario.papel) throw new Error("sessao_alterada"); };
    await confirmarSessao(); const reserva = await rpc("reservar");
    if (reserva?.estado === "concluida") { await confirmarSessao(); return new Response(JSON.stringify({ requestId, fotoId: reserva.fotoId }), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "private, no-store" } }); }
    if (reserva?.estado !== "pendente" || typeof reserva.nome !== "string") return falha(503);
    const partes = reserva.nome.split("/"); if (partes.length !== 3 || partes[0] !== clienteId || partes[1] !== grupoId || !partes.every((v: string) => uuid.test(v))) return falha(503);
    await confirmarSessao();
    const chave = deps.chave(); const endereco = `${deps.url.replace(/\/+$/, "")}/storage/v1/object/sso-grupos-fotos/${partes.map(encodeURIComponent).join("/")}`;
    try { const envio = await deps.fetch(endereco, { method: "POST", headers: { Authorization: `Bearer ${chave}`, apikey: chave, "Content-Type": tipo, "x-upsert": "false" }, body: bytes, redirect: "error", signal: AbortSignal.timeout(15_000) }); await envio.body?.cancel(); } catch { /* Resultado incerto: somente a reserva pode recuperar o objeto. */ }
    await confirmarSessao();
    const objeto = await rpc("recuperar"); if (!objeto || objeto.nome !== reserva.nome || typeof objeto.objetoId !== "string" || !uuid.test(objeto.objetoId)) return falha(409);
    const leitura = `${deps.url.replace(/\/+$/, "")}/storage/v1/object/authenticated/sso-grupos-fotos/${partes.map(encodeURIComponent).join("/")}`;
    const resposta = await deps.fetch(leitura, { headers: { Authorization: `Bearer ${chave}`, apikey: chave }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!resposta.ok || !resposta.body) return falha(503);
    const fonte = resposta.body.getReader(), partesLidas: Uint8Array[] = []; let lidos = 0;
    try { for (;;) { const { done, value } = await fonte.read(); if (done) break; lidos += value.byteLength; if (lidos > 10_485_760) { void fonte.cancel().catch(() => {}); return falha(413); } partesLidas.push(value); } } finally { fonte.releaseLock(); }
    const guardados = new Uint8Array(lidos); pos = 0; for (const bloco of partesLidas) { guardados.set(bloco, pos); pos += bloco.length; }
    if (await hash(guardados) !== digest) return falha(409);
    await confirmarSessao(); const resultado = await rpc("confirmar", objeto.objetoId); await confirmarSessao();
    if (resultado?.estado !== "concluida" || resultado.requestId !== requestId || typeof resultado.fotoId !== "string" || !uuid.test(resultado.fotoId)) return falha(503);
    return new Response(JSON.stringify({ requestId, fotoId: resultado.fotoId }), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
  } catch (e) { return falha(e instanceof Error && e.message === "conflito" ? 409 : 503); }
}
