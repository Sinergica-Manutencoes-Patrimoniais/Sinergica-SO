import { criarRecepcaoAtestada } from "../functions/_shared/cronograma-xlsx/recepcao-atestada.ts";
import { assinarAtestadoXlsx } from "../functions/_shared/cronograma-xlsx/atestado.ts";
const ator = "16891000-0000-4000-8000-000000000001", cliente = "16891000-0000-4000-8000-000000000002", pedido = "16900000-0000-4000-8000-000000000301", lote = "16900000-0000-4000-8000-000000000302";
const chave = new Uint8Array(32).fill(7);
Deno.test("processa XLSX real e envia matriz atestada com mesmo usuário", async () => {
  const arquivo = await Deno.readFile("docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  const chamadas: { url: string; auth: string | null; corpo: Record<string, unknown> | null }[] = [];
  const transporte: typeof fetch = async (input, init) => {
    const req = new Request(input, init); const corpo = req.method === "POST" ? await req.json() : null;
    chamadas.push({ url: req.url, auth: req.headers.get("authorization"), corpo });
    if (req.url.endsWith("/auth/v1/user")) return Response.json({ id: ator, aud: "authenticated" });
    if (req.url.endsWith("/rpc/sso_autorizar_acao")) return Response.json(true);
    if (req.url.endsWith("/rpc/sso_receber_xlsx_atestado")) return Response.json({ aggregateId: lote, requestId: pedido, state: "pendente", revision: 1, created: true });
    return Response.json({}, { status: 404 });
  };
  const receber = criarRecepcaoAtestada("https://supabase.invalid", "chave-publica", chave, transporte);
  const resposta = await receber({ authorization: "Bearer token", cliente, pedido, lote, fonte: "Rimini", bytes: arquivo });
  if (resposta.revision !== 1 || resposta.created !== true || chamadas.length !== 3 || chamadas.some((item) => item.auth !== "Bearer token")) throw new Error("recepção inválida");
  const corpo = chamadas[2]?.corpo!;
  const matrizJson = corpo.p_matriz_texto;
  if (typeof matrizJson !== "string" || !Array.isArray(JSON.parse(matrizJson)) || corpo.p_cliente !== cliente || corpo.p_lote !== lote || corpo.p_request !== pedido) throw new Error("matriz ou escopo inválido");
  const atestado = await assinarAtestadoXlsx(chave, { ator, cliente, pedido, lote, fonte: "Rimini", bytes: arquivo, matrizJson, expira: corpo.p_expira as number });
  if (corpo.p_assinatura !== atestado.assinatura || corpo.p_base64 !== btoa(Array.from(arquivo, (b) => String.fromCharCode(b)).join(""))) throw new Error("atestado ou arquivo divergente");
});
Deno.test("não envia lote quando identidade ou capacidade são recusadas", async () => {
  const arquivo = await Deno.readFile("docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  for (const falha of ["usuario", "capacidade"]) {
    let comandos = 0;
    const transporte: typeof fetch = (input, init) => { const req = new Request(input, init); if (req.url.includes("sso_receber_xlsx_atestado")) comandos++; return Promise.resolve(req.url.endsWith("/auth/v1/user") ? (falha === "usuario" ? Response.json({ message: "negado" }, { status: 401 }) : Response.json({ id: ator, aud: "authenticated" })) : Response.json(false)); };
    let rejeitou = false; try { await criarRecepcaoAtestada("https://supabase.invalid", "publica", chave, transporte)({ authorization: "Bearer token", cliente, pedido, lote, fonte: "Rimini", bytes: arquivo }); } catch { rejeitou = true; }
    if (!rejeitou || comandos) throw new Error("autorização ignorada");
  }
});
Deno.test("recusa recibo do banco associado a outro lote", async () => {
  const arquivo = await Deno.readFile("docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  const transporte: typeof fetch = (input, init) => { const req = new Request(input, init); return Promise.resolve(Response.json(req.url.endsWith("/auth/v1/user") ? { id: ator, aud: "authenticated" } : req.url.endsWith("/rpc/sso_autorizar_acao") ? true : { aggregateId: "outro", requestId: pedido, state: "pendente", revision: 1, created: true })); };
  let rejeitou = false; try { await criarRecepcaoAtestada("https://supabase.invalid", "publica", chave, transporte)({ authorization: "Bearer token", cliente, pedido, lote, fonte: "Rimini", bytes: arquivo }); } catch { rejeitou = true; }
  if (!rejeitou) throw new Error("recibo divergente aceito");
});
