const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const limite = 10 * 1024 * 1024;

/** Leitura interna do objeto reservado; não expõe caminho ou chave na resposta ao usuário. */
export function criarLeituraLimitadaStorage(url: string, chave: string, transporte: typeof fetch = fetch, permitirLegado = false) {
  const origem = new URL(url);
  if (!chave || !["http:", "https:"].includes(origem.protocol) || origem.username || origem.password || origem.search || origem.hash)
    throw new Error("storage_indisponivel");
  const base = origem.toString().replace(/\/+$/, "");
  return async (caminho: string): Promise<Uint8Array> => {
    const partes = caminho.split("/");
    const seguro = partes.length > 0 && partes.every((parte) => !!parte && parte !== "." && parte !== ".." && !parte.includes("\\") && !/[\u0000-\u001f\u007f]/.test(parte));
    if (!seguro || (!permitirLegado && (partes.length !== 3 || !partes.every((parte) => uuid.test(parte))))) throw new Error("caminho_invalido");
    const controle = new AbortController();
    let prazo: ReturnType<typeof setTimeout> | undefined;
    const expiracao = new Promise<never>((_, rejeitar) => {
      prazo = setTimeout(() => { controle.abort(); rejeitar(new Error("download_expirado")); }, 15_000);
    });
    try {
      const endereco = `${base}/storage/v1/object/authenticated/sso-despesas-visita/${partes.map(encodeURIComponent).join("/")}`;
      const resposta = await Promise.race([transporte(endereco, { headers: { Authorization: `Bearer ${chave}`, apikey: chave }, redirect: "error", cache: "no-store", signal: controle.signal }), expiracao]);
      if (!resposta.ok || !resposta.body) { void resposta.body?.cancel().catch(() => {}); throw new Error("download_indisponivel"); }
      const tamanho = resposta.headers.get("content-length");
      if (tamanho && /^\d+$/.test(tamanho) && BigInt(tamanho) > BigInt(limite)) { void resposta.body.cancel().catch(() => {}); throw new Error("arquivo_excedido"); }
      const leitor = resposta.body.getReader(); const partesLidas: Uint8Array[] = []; let total = 0;
      try {
        for (;;) {
          const { done, value } = await Promise.race([leitor.read(), expiracao]); if (done) break;
          total += value.byteLength;
          if (total > limite) throw new Error("arquivo_excedido");
          partesLidas.push(new Uint8Array(value));
        }
      } catch (erro) { void leitor.cancel().catch(() => {}); throw erro; }
      const bytes = new Uint8Array(total); let posicao = 0;
      for (const parte of partesLidas) { bytes.set(parte, posicao); posicao += parte.length; }
      return bytes;
    } finally { if (prazo !== undefined) clearTimeout(prazo); }
  };
}
