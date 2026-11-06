// Dependências externas são fornecidas pela entrada da função.
export interface Dependencias {
  corsHeaders: (origin: string | null) => Record<string, string>;
  identidade: (req: Request) => Promise<{ userId: string; papel: string }>;
  habilitada: () => string | undefined;
  // Cliente Supabase conserva o contrato dinâmico das RPCs.
  cliente: () => any;
  chave: () => string;
  url: string;
  fetch: typeof fetch;
  timeoutCorpoMs?: number;
  timeoutStorageMs?: number;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function criarHandler(deps: Dependencias) {
 return async (req: Request) => {
  const cors = deps.corsHeaders(req.headers.get("origin"));
  const falha = (status: number) => new Response(JSON.stringify({ title: "Foto indisponível", status }), { status, headers: { ...cors, "Content-Type": "application/problem+json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return falha(405);
  try {
    let usuario: Awaited<ReturnType<Dependencias["identidade"]>>;
    try { usuario = await deps.identidade(req); } catch { return falha(401); }
    const { userId, papel } = usuario;
    if (deps.habilitada() !== "true") return falha(503);
    const servico = deps.cliente();
    const { data: permitido, error: limiteErro } = await servico.schema("atendimento").rpc("fn_consumir_rate_limit_webhook", { p_chave: `foto-cadastral-grupo:${userId}`, p_limite: 60, p_janela_segundos: 60 });
    if (limiteErro || typeof permitido !== "boolean") return falha(503);
    if (!permitido) return falha(429);
    if (!req.body) return falha(422);
    const entrada = req.body.getReader(); const dec = new TextDecoder("utf-8", { fatal: true }); let texto = ""; let total = 0;
    let expirou = false;
    const timer = setTimeout(() => { expirou = true; void entrada.cancel().catch(() => {}); }, deps.timeoutCorpoMs ?? 10_000);
    try { for (;;) { const { done, value } = await entrada.read(); if (done) break; total += value.byteLength; if (total > 4096) { void entrada.cancel().catch(() => {}); return falha(413); } texto += dec.decode(value, { stream: true }); } texto += dec.decode(); } finally { clearTimeout(timer); entrada.releaseLock(); }
    if (expirou) return falha(408);
    let corpo: unknown; try { corpo = JSON.parse(texto); } catch { return falha(422); }
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return falha(422);
    const campos = corpo as Record<string, unknown>;
    if (Object.keys(campos).sort().join(",") !== "clienteId,fotoId,grupoId" || ![campos.clienteId, campos.grupoId, campos.fotoId].every((v) => typeof v === "string" && uuid.test(v))) return falha(422);
    const resolver = async () => {
      const { data, error } = await servico.schema("pcm").rpc("sso_resolver_foto_cadastral_grupo_verificada_servico", { p_ator: userId, p_cliente: campos.clienteId, p_grupo: campos.grupoId, p_foto: campos.fotoId, p_papel: papel });
      if (error?.code === "42501") return null;
      if (error || !data || typeof data.objetoId !== "string" || !uuid.test(data.objetoId) || typeof data.nome !== "string") throw new Error("resolucao_indisponivel");
      if (typeof data.verificada !== "boolean" || (data.verificada && (typeof data.digest !== "string" || !/^[a-f0-9]{64}$/.test(data.digest))) || (!data.verificada && data.digest !== null)) throw new Error("digest_invalido");
      return { objetoId: data.objetoId as string, nome: data.nome as string, digest: data.digest as string | null, verificada: data.verificada as boolean };
    };
    const referencia = await resolver(); if (!referencia) return falha(404);
    const partes = referencia.nome.split("/");
    if (partes.some((p) => !p || p === "." || p === ".." || p.includes("\\"))) return falha(503);
    const chave = deps.chave();
    const endereco = `${deps.url.replace(/\/+$/, "")}/storage/v1/object/authenticated/sso-grupos-fotos/${partes.map(encodeURIComponent).join("/")}`;
    const resposta = await deps.fetch(endereco, { headers: { Authorization: `Bearer ${chave}`, apikey: chave }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(deps.timeoutStorageMs ?? 15_000) });
    if (!resposta.ok || !resposta.body) return falha(503);
    const leitor = resposta.body.getReader(); const blocos: Uint8Array[] = []; let tamanho = 0;
    try { for (;;) { const { done, value } = await leitor.read(); if (done) break; tamanho += value.byteLength; if (tamanho > 10_485_760) { await leitor.cancel(); return falha(413); } blocos.push(value); } } finally { leitor.releaseLock(); }
    const bytes = new Uint8Array(tamanho); let pos = 0; for (const bloco of blocos) { bytes.set(bloco, pos); pos += bloco.length; }
    if (referencia.verificada) {
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (n) => n.toString(16).padStart(2, "0")).join("");
      if (hash !== referencia.digest) return falha(409);
    }
    const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const png = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
    if (!jpeg && !png) return falha(415);
    const identidadeAtual = await deps.identidade(req); if (identidadeAtual.userId !== userId || identidadeAtual.papel !== papel) return falha(401);
    const atual = await resolver(); if (!atual || atual.objetoId !== referencia.objetoId || atual.nome !== referencia.nome || atual.digest !== referencia.digest || atual.verificada !== referencia.verificada) return falha(404);
    return new Response(bytes, { headers: { ...cors, "Content-Type": jpeg ? "image/jpeg" : "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "X-SSO-Foto-Verificacao": referencia.verificada ? "sha256" : "historica-sem-digest", "Access-Control-Expose-Headers": "X-SSO-Foto-Verificacao" } });
  } catch { return falha(503); }
 };
}
