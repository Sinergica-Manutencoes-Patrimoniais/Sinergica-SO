// Somente banco descartável montado com fixture_only e migrations 1083/1084.
import { criarRecepcaoAtestada } from "../functions/_shared/cronograma-xlsx/recepcao-atestada.ts";
import { criarAutorizadorXlsx } from "../functions/_shared/cronograma-xlsx/autorizacao.ts";
import { receberXlsxHttp } from "../functions/_shared/cronograma-xlsx/receber-http.ts";
import { processarXlsxEdge } from "../functions/_shared/cronograma-xlsx/processar-edge.ts";
const ator = "16891000-0000-4000-8000-000000000001", cliente = "16891000-0000-4000-8000-000000000002";
const socket = Deno.env.get("SSO_TEST_SOCKET") ?? "";
if (!/^\/tmp\/sso-pg-e2e\.[A-Za-z0-9]+$/.test(socket)) throw new Error("socket descartável inválido");
const textoSql = (s: string) => `convert_from(decode('${btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""))}','base64'),'UTF8')`;
async function psql(sql: string): Promise<string> {
  const processo = new Deno.Command("/opt/homebrew/bin/psql", { args: ["-h", socket, "-p", "56479", "-d", "sso_s169_descartavel", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], stdin: "piped", stdout: "piped", stderr: "piped" }).spawn();
  const escritor = processo.stdin.getWriter(); await escritor.write(new TextEncoder().encode(sql)); await escritor.close();
  const resultado = await processo.output();
  if (!resultado.success) throw new Error("comando PostgreSQL falhou");
  return new TextDecoder().decode(resultado.stdout).trim();
}
for (const [nome, fonte, pedido, lote] of [["plano-rimini-2026-final.xlsx", "Rimini", "16900000-0000-4000-8000-000000000401", "16900000-0000-4000-8000-000000000402"], ["plano-i-home-2026.xlsx", "I Home", "16900000-0000-4000-8000-000000000405", "16900000-0000-4000-8000-000000000406"]] as const) Deno.test(`recebe ${nome} via HTTP e PostgreSQL descartável com replay`, async () => {
  const arquivo = await Deno.readFile(`docs/planejamento/plano-manutencao/fontes/${nome}`);
  const transporte: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    if (req.headers.get("authorization") !== "Bearer token") return Response.json({}, { status: 401 });
    if (req.url.endsWith("/auth/v1/user")) return Response.json({ id: ator, aud: "authenticated" });
    if (req.url.endsWith("/rpc/sso_autorizar_acao")) return Response.json(true);
    if (!req.url.endsWith("/rpc/sso_receber_xlsx_atestado")) return Response.json({}, { status: 404 });
    const c = await req.json();
    const texto = ["p_request", "p_lote", "p_cliente", "p_fonte", "p_matriz_texto", "p_base64", "p_assinatura"];
    if (!texto.every((k) => typeof c[k] === "string") || !Number.isSafeInteger(c.p_expira)) return Response.json({}, { status: 400 });
    const sql = `set test.uid='${ator}'; set role authenticated; select pcm.sso_receber_xlsx_atestado(${textoSql(c.p_request)}::uuid,${textoSql(c.p_lote)}::uuid,${textoSql(c.p_cliente)}::uuid,${textoSql(c.p_fonte)},${textoSql(c.p_matriz_texto)},${textoSql(c.p_base64)},${c.p_expira}::bigint,${textoSql(c.p_assinatura)});`;
    try { return Response.json(JSON.parse(await psql(sql))); } catch { return Response.json({ message: "operação recusada" }, { status: 403 }); }
  };
  const receber = Deno.env.get("SSO_TEST_PROCESSADOR") === "edge"
    ? criarRecepcaoAtestada("https://supabase.invalid", "chave-publica", new Uint8Array(32).fill(7), transporte, processarXlsxEdge)
    : criarRecepcaoAtestada("https://supabase.invalid", "chave-publica", new Uint8Array(32).fill(7), transporte);
  const autorizar = criarAutorizadorXlsx("https://supabase.invalid", "chave-publica", transporte);
  const requisicao = (p: string, l: string, fonte: string) => new Request("http://localhost/", { method: "POST", headers: { authorization: "Bearer token", "content-type": "application/octet-stream", "x-cliente-id": cliente, "x-pedido-id": p, "x-lote-id": l, "x-fonte-id": fonte }, body: new Uint8Array(arquivo).buffer });
  const primeiro = await receberXlsxHttp(requisicao(pedido, lote, fonte), { autorizar, receber });
  const segundo = await receberXlsxHttp(requisicao(pedido, lote, fonte), { autorizar, receber });
  const reciboA = await primeiro.json(), reciboB = await segundo.json();
  if (primeiro.status !== 200 || segundo.status !== 200 || reciboA.revision !== 1 || reciboB.revision !== 1 || reciboA.aggregateId !== lote || reciboA.requestId !== pedido) throw new Error("recibo ou replay inválido");
  const contagem = await psql(`select count(*) from pcm.sso_origens_xlsx_cronograma where lote_id='${lote}';`);
  if (contagem !== "1") throw new Error("origem duplicada ou ausente");
  await psql("update config.permissao_teste set habilitada=false;");
  const loteNegado = "16900000-0000-4000-8000-000000000404";
  try {
    const recusado = await receberXlsxHttp(requisicao("16900000-0000-4000-8000-000000000403", loteNegado, "Rimini-negado"), { autorizar, receber });
    if (recusado.status !== 503 || (await recusado.json()).erro !== "resultado_nao_confirmado" || await psql(`select count(*) from pcm.sso_origens_xlsx_cronograma where lote_id='${loteNegado}';`) !== "0") throw new Error("revogação no banco foi ignorada");
  } finally { await psql("update config.permissao_teste set habilitada=true;"); }
});
