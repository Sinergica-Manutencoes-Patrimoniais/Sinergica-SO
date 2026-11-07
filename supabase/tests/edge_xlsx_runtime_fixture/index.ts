// Exclusivo para teste local: transporte é totalmente simulado; não há credenciais reais.
import { criarBordaConfigurada } from "../../functions/_shared/cronograma-xlsx/borda-configurada.ts";
import { processarXlsxIsolado } from "../../functions/_shared/cronograma-xlsx/processar-isolado.ts";
import { processarXlsxEdge } from "../../functions/_shared/cronograma-xlsx/processar-edge.ts";
import { criarRecepcaoAtestada } from "../../functions/_shared/cronograma-xlsx/recepcao-atestada.ts";
import { assinarAtestadoXlsx } from "../../functions/_shared/cronograma-xlsx/atestado.ts";
import { criarBordaXlsx } from "../../functions/_shared/cronograma-xlsx/borda.ts";
import { criarAutorizadorXlsx } from "../../functions/_shared/cronograma-xlsx/autorizacao.ts";

const ator = "16891000-0000-4000-8000-000000000001";
const pedido = "16900000-0000-4000-8000-000000000301";
const lote = "16900000-0000-4000-8000-000000000302";
const transporte: typeof fetch = async (input, init) => {
  const req = new Request(input, init);
  if (new URL(req.url).origin !== "https://supabase.invalid") throw new Error("Rede externa não permitida.");
  if (req.url.endsWith("/auth/v1/user")) return req.headers.get("authorization") === "Bearer token" ? Response.json({ id: ator, aud: "authenticated" }) : Response.json({ error: "invalid" }, { status: 401 });
  if (req.url.endsWith("/rpc/fn_consumir_rate_limit_webhook")) return Response.json(true);
  if (req.url.endsWith("/rpc/sso_autorizar_acao")) { const corpo = await req.json(); return Response.json(corpo.p_cliente_id === "16891000-0000-4000-8000-000000000002"); }
  if (req.url.endsWith("/rpc/sso_receber_xlsx_atestado")) {
    const corpo = await req.json();
    if (corpo.p_request !== pedido || corpo.p_lote !== lote || corpo.p_fonte !== "Rimini" || typeof corpo.p_assinatura !== "string") return Response.json({}, { status: 400 });
    const binario = atob(corpo.p_base64);
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    const esperado = await assinarAtestadoXlsx(new Uint8Array(32).fill(7), { ator, cliente: corpo.p_cliente, pedido, lote, fonte: corpo.p_fonte, bytes, matrizJson: corpo.p_matriz_texto, expira: corpo.p_expira });
    if (esperado.assinatura !== corpo.p_assinatura) return Response.json({}, { status: 400 });
    return Response.json({ requestId: pedido, aggregateId: lote, state: "pendente", revision: 1, created: true });
  }
  return Response.json({}, { status: 404 });
};

const borda = criarBordaConfigurada({ habilitado: true, url: "https://supabase.invalid", publica: "publica", servico: "servico", segredo: "07".repeat(32), origens: ["https://sso.example"] }, transporte);
const bordaExperimental = criarBordaXlsx({ habilitado: true, origens: ["https://sso.example"],
  autenticar: (req) => req.headers.get("authorization") === "Bearer token" ? Promise.resolve(ator) : Promise.reject(new Error("negado")),
  limitar: () => Promise.resolve(true), autorizar: criarAutorizadorXlsx("https://supabase.invalid", "publica", transporte),
  receber: criarRecepcaoAtestada("https://supabase.invalid", "publica", new Uint8Array(32).fill(7), transporte, processarXlsxEdge),
});
Deno.serve(async (req) => {
  if (new URL(req.url).pathname === "/diagnostico-borda") return bordaExperimental(req);
  if (new URL(req.url).pathname === "/diagnostico-recepcao") {
    try {
      const receber = criarRecepcaoAtestada("https://supabase.invalid", "publica", new Uint8Array(32).fill(7), transporte, processarXlsxEdge);
      const recibo = await receber({ authorization: "Bearer token", cliente: "16891000-0000-4000-8000-000000000002", pedido, lote, fonte: "Rimini", bytes: new Uint8Array(await req.arrayBuffer()) });
      return Response.json(recibo);
    } catch (erro) {
      return Response.json({ erro: String(erro) }, { status: 500 });
    }
  }
  if (new URL(req.url).pathname === "/diagnostico-direto") {
    try {
      const bytes = new Uint8Array(await req.arrayBuffer());
      const resultado = await processarXlsxEdge(bytes, "fonte", "cliente");
      return Response.json({ estado: resultado.previa.estado, linhas: resultado.previa.linhas.length, sha256: resultado.sha256, matriz: !!resultado.matriz });
    } catch {
      return Response.json({ erro: "arquivo_invalido" }, { status: 422 });
    }
  }
  if (new URL(req.url).pathname === "/diagnostico") {
    try {
      const resultado = await processarXlsxIsolado(new Uint8Array(await req.arrayBuffer()), "Rimini", "16891000-0000-4000-8000-000000000002");
      return Response.json({ estado: resultado.previa.estado });
    } catch (erro) {
      return Response.json({ erro: String(erro) }, { status: 500 });
    }
  }
  return borda(req);
});
