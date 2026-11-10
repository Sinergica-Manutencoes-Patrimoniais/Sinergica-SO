import { receberXlsxHttp } from "../functions/_shared/cronograma-xlsx/receber-http.ts";
import { criarRecepcaoAtestada } from "../functions/_shared/cronograma-xlsx/recepcao-atestada.ts";
import { criarAutorizadorXlsx } from "../functions/_shared/cronograma-xlsx/autorizacao.ts";
const cliente = "16891000-0000-4000-8000-000000000002", pedido = "16900000-0000-4000-8000-000000000301", lote = "16900000-0000-4000-8000-000000000302";
const headers = { authorization: "Bearer token", "content-type": "application/octet-stream", "x-cliente-id": cliente, "x-fonte-id": "Rimini", "x-pedido-id": pedido, "x-lote-id": lote };
const req = (substituir: Record<string, string> = {}) => new Request("http://localhost/", { method: "POST", headers: { ...headers, ...substituir }, body: new Uint8Array([1,2,3]).buffer });
Deno.test("recebe arquivo e devolve somente recibo do pedido e lote", async () => {
  let chamada = 0;
  const resposta = await receberXlsxHttp(req(), { autorizar: async () => true, receber: async (entrada: { authorization: string; cliente: string; pedido: string; lote: string; fonte: string; bytes: Uint8Array }) => { chamada++; if (entrada.authorization !== "Bearer token" || entrada.cliente !== cliente || entrada.pedido !== pedido || entrada.lote !== lote || entrada.fonte !== "Rimini" || entrada.bytes.join(",") !== "1,2,3") throw new Error("entrada divergente"); return { revision: 1, created: true }; } });
  const corpo = await resposta.json();
  if (resposta.status !== 200 || corpo.requestId !== pedido || corpo.aggregateId !== lote || corpo.state !== "pendente" || corpo.revision !== 1 || corpo.created !== true || "matriz" in corpo || "assinatura" in corpo || chamada !== 1) throw new Error("recibo inválido");
});
Deno.test("recusa IDs inválidos ou permissão negada antes de processar", async () => {
  let chamadas = 0; const receber = async () => { chamadas++; return { revision: 1, created: true }; };
  const invalido = await receberXlsxHttp(req({ "x-pedido-id": "invalido" }), { autorizar: async () => true, receber });
  const negado = await receberXlsxHttp(req(), { autorizar: async () => false, receber });
  if (invalido.status !== 400 || negado.status !== 403 || chamadas) throw new Error("bloqueio ausente");
});
Deno.test("falha após iniciar recepção informa resultado incerto", async () => {
  const resposta = await receberXlsxHttp(req(), { autorizar: async () => true, receber: async () => { throw new Error("detalhe sensível"); } });
  const corpo = await resposta.json();
  if (resposta.status !== 503 || corpo.erro !== "resultado_nao_confirmado" || JSON.stringify(corpo).includes("sensível")) throw new Error("falha não tratada");
});
Deno.test("integra HTTP, worker real e RPC simulada com XLSX original", async () => {
  const bytes = await Deno.readFile("docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  const transporte: typeof fetch = (input, init) => { const r = new Request(input, init); return Promise.resolve(Response.json(r.url.endsWith("/auth/v1/user") ? { id: "16891000-0000-4000-8000-000000000001", aud: "authenticated" } : r.url.endsWith("/rpc/sso_autorizar_acao") ? true : { aggregateId: lote, requestId: pedido, state: "pendente", revision: 1, created: true })); };
  const requisicao = new Request("http://localhost/", { method: "POST", headers, body: bytes.buffer as ArrayBuffer });
  const resposta = await receberXlsxHttp(requisicao, { autorizar: criarAutorizadorXlsx("https://supabase.invalid", "publica", transporte), receber: criarRecepcaoAtestada("https://supabase.invalid", "publica", new Uint8Array(32).fill(7), transporte) });
  const corpo = await resposta.json();
  if (resposta.status !== 200 || corpo.aggregateId !== lote || corpo.requestId !== pedido || corpo.state !== "pendente" || corpo.revision !== 1) throw new Error("integração inválida");
});
Deno.test("fonte UTF-8 chega íntegra à RPC atestada", async () => {
  const arquivo = await Deno.readFile("docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  let fonteRecebida = "";
  const transporte: typeof fetch = async (input, init) => {
    const r = new Request(input, init);
    if (r.url.endsWith("/auth/v1/user")) return Response.json({ id: "16891000-0000-4000-8000-000000000001", aud: "authenticated" });
    if (r.url.endsWith("/rpc/sso_autorizar_acao")) return Response.json(true);
    if (r.url.endsWith("/rpc/sso_receber_xlsx_atestado")) { fonteRecebida = (await r.json()).p_fonte; return Response.json({ aggregateId: lote, requestId: pedido, state: "pendente", revision: 1, created: true }); }
    throw new Error("Chamada inesperada.");
  };
  const { "x-fonte-id": _legado, ...semLegado } = headers;
  const requisicao = new Request("http://localhost/", { method: "POST", headers: { ...semLegado, "x-fonte-id-utf8": "S%C3%A3o%20Jo%C3%A3o%20%E2%80%94%20Torre%20A" }, body: arquivo.buffer as ArrayBuffer });
  const resposta = await receberXlsxHttp(requisicao, { autorizar: criarAutorizadorXlsx("https://supabase.invalid", "publica", transporte), receber: criarRecepcaoAtestada("https://supabase.invalid", "publica", new Uint8Array(32).fill(7), transporte) });
  if (resposta.status !== 200 || fonteRecebida !== "São João — Torre A") throw new Error("Fonte alterada no fluxo.");
});
