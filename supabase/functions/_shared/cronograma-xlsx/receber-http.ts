import { FalhaRecepcaoIncerta, prepararRecepcaoXlsx } from "./preparar-http.ts";

type Entrada = { authorization: string; cliente: string; pedido: string; lote: string; fonte: string; bytes: Uint8Array; signal: AbortSignal };
type Dependencias = { autorizar: (authorization: string, cliente: string) => Promise<boolean>; receber: (entrada: Entrada) => Promise<{ revision: number; created: boolean }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Não registrado como endpoint; o consumidor deve manter os gates fechados até homologação. */
export async function receberXlsxHttp(req: Request, deps: Dependencias): Promise<Response> {
  const pedido = req.headers.get("x-pedido-id") ?? "";
  const lote = req.headers.get("x-lote-id") ?? "";
  if (!uuid.test(pedido) || !uuid.test(lote)) return new Response(JSON.stringify({ erro: "identificadores_invalidos" }), { status: 400, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  return prepararRecepcaoXlsx(req, {
    autorizar: deps.autorizar,
    processar: async (bytes, fonte, cliente, signal) => {
      try {
        const recibo = await deps.receber({ authorization: req.headers.get("authorization") ?? "", cliente, pedido, lote, fonte, bytes, signal });
        return { estado: "guardado", requestId: pedido, aggregateId: lote, revision: recibo.revision, created: recibo.created };
      } catch { throw new FalhaRecepcaoIncerta(); }
    },
  });
}
