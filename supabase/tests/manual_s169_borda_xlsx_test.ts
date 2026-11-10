import { criarBordaXlsx } from "../functions/_shared/cronograma-xlsx/borda.ts";
import { criarAutorizadorXlsx } from "../functions/_shared/cronograma-xlsx/autorizacao.ts";
import { criarRecepcaoAtestada } from "../functions/_shared/cronograma-xlsx/recepcao-atestada.ts";

const origem = "https://sso.example";
const ids = { "x-pedido-id": "16900000-0000-4000-8000-000000000301", "x-lote-id": "16900000-0000-4000-8000-000000000302", "x-cliente-id": "16891000-0000-4000-8000-000000000002", "x-fonte-id": "Rimini" };
function pedido(extra: Record<string, string> = {}) {
  return new Request("https://edge.example", { method: "POST", headers: { ...ids, origin: origem, authorization: "Bearer token", "content-type": "application/octet-stream", ...extra }, body: new Uint8Array([1, 2, 3]) });
}
function deps() {
  return { habilitado: true, origens: [origem], autenticar: async () => "16891000-0000-4000-8000-000000000001", limitar: async (_usuario: string) => true, autorizar: async () => true, receber: async () => ({ revision: 1, created: true }) };
}
function afirmar(ok: boolean, mensagem: string) { if (!ok) throw new Error(mensagem); }

Deno.test("origem autorizada recebe preflight com os headers da importação", async () => {
  const resposta = await criarBordaXlsx(deps())(new Request("https://edge.example", { method: "OPTIONS", headers: { origin: origem, "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type,x-pedido-id,x-lote-id,x-cliente-id,x-fonte-id" } }));
  afirmar(resposta.status === 204 && resposta.headers.get("access-control-allow-origin") === origem && (resposta.headers.get("access-control-allow-headers") ?? "").includes("x-pedido-id"), "preflight indisponível");
});
Deno.test("origem não autorizada não recebe CORS nem processa corpo", async () => {
  let processou = false; const d = deps(); d.receber = async () => { processou = true; return { revision: 1, created: true }; };
  const resposta = await criarBordaXlsx(d)(pedido({ origin: "https://outro.example" }));
  afirmar(resposta.status === 403 && !resposta.headers.has("access-control-allow-origin") && !processou, "origem indevida aceita");
});
Deno.test("gate fechado, autenticação e limite bloqueiam processamento", async () => {
  let processou = 0; const d = deps(); d.receber = async () => { processou++; return { revision: 1, created: true }; };
  const fechado = await criarBordaXlsx({ ...d, habilitado: false })(pedido());
  const semSessao = await criarBordaXlsx({ ...d, autenticar: async () => { throw new Error("token"); } })(pedido());
  const limite = await criarBordaXlsx({ ...d, limitar: async () => false })(pedido());
  const falha = await criarBordaXlsx({ ...d, limitar: async () => { throw new Error("interno"); } })(pedido());
  afirmar(fechado.status === 503 && semSessao.status === 401 && limite.status === 429 && falha.status === 503 && processou === 0, "proteção ausente");
});
Deno.test("requisição autorizada entrega apenas recibo pendente", async () => {
  const resposta = await criarBordaXlsx(deps())(pedido()); const corpo = await resposta.json();
  afirmar(resposta.status === 200 && corpo.state === "pendente" && corpo.requestId === ids["x-pedido-id"] && corpo.aggregateId === ids["x-lote-id"] && !('matriz' in corpo) && resposta.headers.get("cache-control") === "no-store", "resposta incorreta");
});
Deno.test("borda processa arquivo original no worker e envia atestado ao transporte", async () => {
  const bytes = await Deno.readFile("docs/planejamento/plano-manutencao/fontes/plano-i-home-2026.xlsx");
  let gravacoes = 0;
  const transporte: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    if (req.url.endsWith("/auth/v1/user")) return Response.json({ id: "16891000-0000-4000-8000-000000000001", aud: "authenticated" });
    if (req.url.endsWith("/rpc/sso_autorizar_acao")) return Response.json(true);
    if (req.url.endsWith("/rpc/sso_receber_xlsx_atestado")) {
      const dados = await req.json();
      afirmar(dados.p_request === ids["x-pedido-id"] && dados.p_lote === ids["x-lote-id"] && typeof dados.p_assinatura === "string" && typeof dados.p_matriz_texto === "string", "atestado incorreto");
      gravacoes++;
      return Response.json({ requestId: ids["x-pedido-id"], aggregateId: ids["x-lote-id"], state: "pendente", revision: 1, created: true });
    }
    throw new Error("transporte inesperado");
  };
  const d = { ...deps(), autorizar: criarAutorizadorXlsx("https://supabase.invalid", "publica", transporte), receber: criarRecepcaoAtestada("https://supabase.invalid", "publica", new Uint8Array(32).fill(7), transporte) };
  const req = new Request("https://edge.example", { method: "POST", headers: { ...ids, origin: origem, authorization: "Bearer token", "content-type": "application/octet-stream" }, body: bytes.buffer as ArrayBuffer });
  const resultado = await criarBordaXlsx(d)(req);
  afirmar(resultado.status === 200 && gravacoes === 1 && (await resultado.json()).state === "pendente", "integração recusada");
});
