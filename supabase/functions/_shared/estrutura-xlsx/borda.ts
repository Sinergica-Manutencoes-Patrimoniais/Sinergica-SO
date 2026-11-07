type Entrada = { authorization: string; cliente: string; pedido: string; origem: string; aba: string; bytes: Uint8Array; signal: AbortSignal };
type Dependencias = {
  habilitado: boolean;
  origens: readonly string[];
  autenticar: (req: Request) => Promise<string>;
  limitar: (usuario: string) => Promise<boolean>;
  autorizar: (authorization: string, cliente: string) => Promise<boolean>;
  receber: (entrada: Entrada) => Promise<{ destino: "lote" | "quarentena"; id: string }>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LIMITE = 5_242_880;

/** Borda não registrada. Gate no banco e autorização transacional continuam obrigatórios. */
export function criarBordaEstruturaXlsx(deps: Dependencias) {
  const origens = new Set(deps.origens);
  return async (req: Request): Promise<Response> => {
    const origemHttp = req.headers.get("origin");
    const cabecalhos = new Headers({ vary: "Origin", "cache-control": "no-store", "x-content-type-options": "nosniff" });
    const responder = (status: number, corpo: object) => {
      const headers = new Headers(cabecalhos); headers.set("content-type", "application/json");
      return new Response(JSON.stringify(corpo), { status, headers });
    };
    if (origemHttp !== null && !origens.has(origemHttp)) return responder(403, { erro: "origem_nao_permitida" });
    if (origemHttp !== null) cabecalhos.set("access-control-allow-origin", origemHttp);
    if (req.method === "OPTIONS") {
      if (!origemHttp || req.headers.get("access-control-request-method") !== "POST") return responder(400, { erro: "preflight_invalido" });
      cabecalhos.set("access-control-allow-methods", "POST, OPTIONS");
      cabecalhos.set("access-control-allow-headers", "authorization, apikey, x-client-info, content-type, x-cliente-id, x-pedido-id, x-origem-utf8, x-aba-utf8");
      return new Response(null, { status: 204, headers: cabecalhos });
    }
    if (req.method !== "POST") return responder(405, { erro: "metodo_nao_permitido" });
    if (!deps.habilitado) return responder(503, { erro: "recepcao_indisponivel" });
    const authorization = req.headers.get("authorization") ?? "";
    const cliente = req.headers.get("x-cliente-id") ?? "";
    const pedido = req.headers.get("x-pedido-id") ?? "";
    let origem: string; let aba: string;
    try {
      const origemCodificada = req.headers.get("x-origem-utf8"); const abaCodificada = req.headers.get("x-aba-utf8");
      if (origemCodificada === null || abaCodificada === null) throw new Error();
      origem = decodeURIComponent(origemCodificada); aba = decodeURIComponent(abaCodificada);
      if (encodeURIComponent(origem) !== origemCodificada || encodeURIComponent(aba) !== abaCodificada) throw new Error();
    } catch { return responder(400, { erro: "requisicao_invalida" }); }
    if (!/^Bearer [^\s]+$/i.test(authorization)) return responder(401, { erro: "nao_autenticado" });
    if (!uuid.test(cliente) || !uuid.test(pedido) || !origem || origem !== origem.trim() || origem.length > 200 ||
      !aba || aba.length > 31 || /[\u0000-\u001f\u007f-\u009f]/.test(origem + aba) || req.headers.get("content-type") !== "application/octet-stream")
      return responder(400, { erro: "requisicao_invalida" });
    let usuario: string;
    try { usuario = await deps.autenticar(req); } catch { return responder(401, { erro: "nao_autenticado" }); }
    if (!uuid.test(usuario)) return responder(401, { erro: "nao_autenticado" });
    try { if (await deps.limitar(usuario) !== true) return responder(429, { erro: "limite_excedido" }); }
    catch { return responder(503, { erro: "limite_indisponivel" }); }
    try { if (await deps.autorizar(authorization, cliente) !== true) return responder(403, { erro: "sem_acesso" }); }
    catch { return responder(503, { erro: "autorizacao_indisponivel" }); }
    const tamanho = req.headers.get("content-length");
    if (tamanho !== null && (!/^\d+$/.test(tamanho) || !Number.isSafeInteger(Number(tamanho)))) return responder(400, { erro: "tamanho_invalido" });
    if (tamanho !== null && Number(tamanho) > LIMITE) return responder(413, { erro: "arquivo_extenso" });
    if (!req.body) return responder(400, { erro: "arquivo_ausente" });
    const leitor = req.body.getReader(); const partes: Uint8Array[] = []; let total = 0; let expirou = false;
    let rejeitarInterrupcao: (erro: Error) => void = () => {};
    const interrupcao = new Promise<never>((_resolve, rejeitar) => { rejeitarInterrupcao = rejeitar; });
    // A rejeição também é consumida se a requisição for encerrada entre leituras.
    void interrupcao.catch(() => {});
    const cancelarLeitor = () => { void leitor.cancel().catch(() => {}); };
    const interromper = () => { cancelarLeitor(); rejeitarInterrupcao(new Error("leitura_interrompida")); };
    const prazo = setTimeout(() => { expirou = true; cancelarLeitor(); rejeitarInterrupcao(new Error("leitura_expirada")); }, 10_000);
    req.signal.addEventListener("abort", interromper, { once: true });
    if (req.signal.aborted) interromper();
    try {
      while (true) {
        req.signal.throwIfAborted();
        const { done, value } = await Promise.race([leitor.read(), interrupcao]);
        req.signal.throwIfAborted();
        if (expirou) return responder(408, { erro: "leitura_expirada" });
        if (done) break;
        total += value.byteLength;
        if (total > LIMITE) { cancelarLeitor(); return responder(413, { erro: "arquivo_extenso" }); }
        partes.push(value);
      }
      clearTimeout(prazo);
      if (!total || (tamanho !== null && Number(tamanho) !== total)) return responder(400, { erro: "tamanho_invalido" });
      const bytes = new Uint8Array(total); let posicao = 0;
      for (const parte of partes) { bytes.set(parte, posicao); posicao += parte.byteLength; }
      try {
        const recibo = await deps.receber({ authorization, cliente, pedido, origem, aba, bytes, signal: req.signal });
        if (!recibo || !["lote", "quarentena"].includes(recibo.destino) || !uuid.test(recibo.id)) throw new Error();
        return responder(200, { requestId: pedido, destino: recibo.destino, id: recibo.id, oficialAlterado: false });
      } catch { return responder(503, { erro: "resultado_nao_confirmado" }); }
    } catch { return responder(expirou ? 408 : 400, { erro: expirou ? "leitura_expirada" : "leitura_interrompida" }); }
    finally { clearTimeout(prazo); req.signal.removeEventListener("abort", interromper); try { leitor.releaseLock(); } catch { /* Cancelamento pode continuar em voo. */ } }
  };
}
