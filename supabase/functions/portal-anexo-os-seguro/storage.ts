const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Retorna fluxo privado; o handler limita o corpo a 10 MiB e revalida autorização. */
export function criarDownloadAnexoPortal(url: string, chave: string, transporte: typeof fetch = fetch) {
  const origem = new URL(url);
  if (!chave || !["http:", "https:"].includes(origem.protocol) || origem.username || origem.password || origem.search || origem.hash) throw new Error("storage_indisponivel");
  const base = origem.toString().replace(/\/+$/, "");
  return async (caminho: string): Promise<Response> => {
    const partes = caminho.split("/");
    if (partes.length < 2 || !uuid.test(partes[0]) || partes.some((p) => !p || p === "." || p === ".." || p.includes("\\") || /[\u0000-\u001f\u007f]/.test(p))) throw new Error("caminho_invalido");
    const endereco = `${base}/storage/v1/object/authenticated/os-anexos/${partes.map(encodeURIComponent).join("/")}`;
    const resposta = await transporte(endereco, { headers: { Authorization: `Bearer ${chave}`, apikey: chave }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!resposta.ok || !resposta.body) { void resposta.body?.cancel().catch(() => {}); throw new Error("arquivo_indisponivel"); }
    const tamanho = resposta.headers.get("content-length");
    if (tamanho && /^\d+$/.test(tamanho) && BigInt(tamanho) > 10n * 1024n * 1024n) { void resposta.body.cancel().catch(() => {}); throw new Error("arquivo_excedido"); }
    return resposta;
  };
}
