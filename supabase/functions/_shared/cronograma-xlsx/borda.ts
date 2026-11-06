import { receberXlsxHttp } from "./receber-http.ts";

type Entrada = { authorization: string; cliente: string; pedido: string; lote: string; fonte: string; bytes: Uint8Array; signal: AbortSignal };
type Dependencias = {
  habilitado: boolean;
  origens: readonly string[];
  autenticar: (req: Request) => Promise<string>;
  limitar: (usuario: string) => Promise<boolean>;
  autorizar: (authorization: string, cliente: string) => Promise<boolean>;
  receber: (entrada: Entrada) => Promise<{ revision: number; created: boolean }>;
};

/** Borda não registrada. Autorização transacional e gate de banco continuam obrigatórios. */
export function criarBordaXlsx(deps: Dependencias) {
  const origens = new Set(deps.origens);
  return async (req: Request): Promise<Response> => {
    const origem = req.headers.get("origin");
    const cors = new Headers({ vary: "Origin", "cache-control": "no-store", "x-content-type-options": "nosniff" });
    const resposta = (status: number, erro: string) => new Response(JSON.stringify({ erro }), { status, headers: new Headers([...cors, ["content-type", "application/json"]]) });
    if (origem !== null && !origens.has(origem)) return resposta(403, "origem_nao_permitida");
    if (origem !== null) cors.set("access-control-allow-origin", origem);
    if (req.method === "OPTIONS") {
      if (!origem || req.headers.get("access-control-request-method") !== "POST") return resposta(400, "preflight_invalido");
      cors.set("access-control-allow-methods", "POST, OPTIONS");
      cors.set("access-control-allow-headers", "authorization, apikey, x-client-info, content-type, x-cliente-id, x-fonte-id, x-fonte-id-utf8, x-pedido-id, x-lote-id");
      return new Response(null, { status: 204, headers: cors });
    }
    if (req.method !== "POST") return resposta(405, "metodo_nao_permitido");
    if (!deps.habilitado) return resposta(503, "recepcao_indisponivel");
    let usuario: string;
    try { usuario = await deps.autenticar(req); }
    catch { return resposta(401, "nao_autenticado"); }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usuario)) return resposta(401, "nao_autenticado");
    try { if (await deps.limitar(usuario) !== true) return resposta(429, "limite_excedido"); }
    catch { return resposta(503, "limite_indisponivel"); }
    const resultado = await receberXlsxHttp(req, { autorizar: deps.autorizar, receber: deps.receber });
    cors.forEach((valor, chave) => resultado.headers.set(chave, valor));
    return resultado;
  };
}
