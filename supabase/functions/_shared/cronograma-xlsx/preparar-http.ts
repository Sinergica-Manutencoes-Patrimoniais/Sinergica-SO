type Resultado = { estado: "conferivel" | "pendente"; linhas: number; sha256: string };
type Recibo = { estado: "guardado"; requestId: string; aggregateId: string; revision: number; created: boolean };
export class FalhaRecepcaoIncerta extends Error {}
type Dependencias = {
  autorizar: (authorization: string, clienteId: string) => Promise<boolean>;
  processar: (bytes: Uint8Array, fonteId: string, clienteId: string, signal: AbortSignal) => Promise<Resultado | Recibo>;
};
const LIMITE = 5_242_880;
const resposta = (status: number, corpo: object) => new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" } });

/** Handler não registrado: autenticação e isolamento de runtime devem ser ligados pelo consumidor. */
export async function prepararRecepcaoXlsx(req: Request, deps: Dependencias): Promise<Response> {
  if (req.method !== "POST") return resposta(405, { erro: "metodo_nao_permitido" });
  const autorizacao = req.headers.get("authorization") ?? "";
  const cliente = req.headers.get("x-cliente-id") ?? "";
  const legado = req.headers.get("x-fonte-id");
  const codificado = req.headers.get("x-fonte-id-utf8");
  let fonte = "";
  if (legado !== null && codificado !== null) return resposta(400, { erro: "requisicao_invalida" });
  if (codificado !== null) {
    try { fonte = decodeURIComponent(codificado); if (encodeURIComponent(fonte) !== codificado) throw new Error(); }
    catch { return resposta(400, { erro: "requisicao_invalida" }); }
  } else fonte = legado ?? "";
  if (!/^Bearer [^\s]+$/i.test(autorizacao)) return resposta(401, { erro: "nao_autenticado" });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cliente) || !fonte || fonte !== fonte.trim() || fonte.length > 188 || /[\u0000-\u001f\u007f-\u009f]/.test(fonte) || req.headers.get("content-type") !== "application/octet-stream") return resposta(400, { erro: "requisicao_invalida" });
  try { if (await deps.autorizar(autorizacao, cliente) !== true) return resposta(403, { erro: "sem_acesso" }); }
  catch { return resposta(503, { erro: "autorizacao_indisponivel" }); }
  const comprimento = req.headers.get("content-length");
  if (comprimento !== null && (!/^\d+$/.test(comprimento) || !Number.isSafeInteger(Number(comprimento)))) return resposta(400, { erro: "tamanho_invalido" });
  if (comprimento !== null && Number(comprimento) > LIMITE) return resposta(413, { erro: "arquivo_extenso" });
  if (!req.body) return resposta(400, { erro: "arquivo_ausente" });
  const leitor = req.body.getReader(); const partes: Uint8Array[] = []; let total = 0;
  let expirou = false;
  const interromper = () => { void leitor.cancel().catch(() => {}); };
  const prazo = setTimeout(() => { expirou = true; interromper(); }, 10_000);
  req.signal.addEventListener("abort", interromper, { once: true });
  if (req.signal.aborted) interromper();
  try {
    while (true) {
      req.signal.throwIfAborted();
      const { done, value } = await leitor.read();
      req.signal.throwIfAborted();
      if (expirou) return resposta(408, { erro: "leitura_expirada" });
      if (done) break;
      total += value.byteLength;
      if (total > LIMITE) { void leitor.cancel().catch(() => {}); return resposta(413, { erro: "arquivo_extenso" }); }
      partes.push(value);
    }
    clearTimeout(prazo);
    if (!total || (comprimento !== null && Number(comprimento) !== total)) return resposta(400, { erro: "tamanho_invalido" });
    const bytes = new Uint8Array(total); let posicao = 0;
    for (const parte of partes) { bytes.set(parte, posicao); posicao += parte.byteLength; }
    const resultado = await deps.processar(bytes, fonte, cliente, req.signal);
    if (resultado?.estado === "guardado") {
      if (!Number.isSafeInteger(resultado.revision) || resultado.revision < 1 || typeof resultado.created !== "boolean" || typeof resultado.requestId !== "string" || typeof resultado.aggregateId !== "string") throw new FalhaRecepcaoIncerta();
      return resposta(200, { requestId: resultado.requestId, aggregateId: resultado.aggregateId, state: "pendente", revision: resultado.revision, created: resultado.created });
    }
    if (!resultado || !["conferivel", "pendente"].includes(resultado.estado) || !Number.isSafeInteger(resultado.linhas) || resultado.linhas < 0 || !/^[a-f0-9]{64}$/.test(resultado.sha256)) throw new Error("resultado inválido");
    return resposta(200, { estado: resultado.estado, linhas: resultado.linhas, sha256: resultado.sha256 });
  } catch (erro) { return erro instanceof FalhaRecepcaoIncerta ? resposta(503, { erro: "resultado_nao_confirmado" }) : resposta(422, { erro: "arquivo_invalido" }); }
  finally { clearTimeout(prazo); req.signal.removeEventListener("abort", interromper); leitor.releaseLock(); }
}
