import { criarBordaConfigurada } from "../functions/_shared/cronograma-xlsx/borda-configurada.ts";

const ator = "16891000-0000-4000-8000-000000000001", cliente = "16891000-0000-4000-8000-000000000002";
const pedido = "16900000-0000-4000-8000-000000000301", lote = "16900000-0000-4000-8000-000000000302";
const config = { habilitado: true, url: "https://supabase.invalid", publica: "publica", servico: "servico", segredo: "07".repeat(32), origens: ["https://sso.example"] };
const headers = { origin: "https://sso.example", authorization: "Bearer token", "content-type": "application/octet-stream", "x-cliente-id": cliente, "x-fonte-id": "Rimini", "x-pedido-id": pedido, "x-lote-id": lote };
function req(bytes = new Uint8Array([1, 2, 3])) { return new Request("https://edge.invalid/", { method: "POST", headers, body: bytes.buffer as ArrayBuffer }); }
function afirmar(valor: boolean, mensagem: string) { if (!valor) throw new Error(mensagem); }

Deno.test("gate fechado impede autenticação e processamento", async () => {
  let chamadas = 0; const transporte: typeof fetch = () => { chamadas++; throw new Error("não acessar"); };
  const resposta = await criarBordaConfigurada({ ...config, habilitado: false }, transporte)(req());
  afirmar(resposta.status === 503 && chamadas === 0, "gate não bloqueou");
});
Deno.test("runtime sem Worker impede chamadas externas antes de receber arquivo", async () => {
  const anterior = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  let chamadas = 0;
  try {
    Object.defineProperty(globalThis, "Worker", { value: undefined, configurable: true });
    const transporte: typeof fetch = () => { chamadas++; throw new Error("não acessar"); };
    const resposta = await criarBordaConfigurada(config, transporte)(req());
    afirmar(resposta.status === 503 && chamadas === 0 && (await resposta.json()).erro === "recepcao_indisponivel", "runtime incompatível não foi bloqueado");
  } finally {
    if (anterior) Object.defineProperty(globalThis, "Worker", anterior);
    else Reflect.deleteProperty(globalThis, "Worker");
  }
});
Deno.test("nega limite excedido sem iniciar leitura ou comando", async () => {
  let escrita = false; const transporte: typeof fetch = (input, init) => {
    const r = new Request(input, init);
    if (r.url.endsWith("/auth/v1/user")) return Promise.resolve(Response.json({ id: ator, aud: "authenticated" }));
    if (r.url.endsWith("/rpc/fn_consumir_rate_limit_webhook")) return Promise.resolve(Response.json(false));
    escrita = true; return Promise.resolve(Response.json({}));
  };
  const resposta = await criarBordaConfigurada(config, transporte)(req());
  afirmar(resposta.status === 429 && !escrita, "limite não respeitado");
});
Deno.test("conecta Auth, limite privilegiado, worker e RPC de negócio com JWT do usuário", async () => {
  const arquivo = await Deno.readFile("docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  let escrita = 0, limite = 0;
  const transporte: typeof fetch = async (input, init) => {
    const r = new Request(input, init); const token = r.headers.get("authorization");
    if (r.url.endsWith("/auth/v1/user")) { afirmar(token === "Bearer token", "Auth sem JWT"); return Response.json({ id: ator, aud: "authenticated" }); }
    if (r.url.endsWith("/rpc/fn_consumir_rate_limit_webhook")) {
      const dados = await r.json(); afirmar(token === "Bearer servico" && dados.p_chave === `xlsx-cronograma:${ator}` && dados.p_limite === 10 && dados.p_janela_segundos === 60, "limite incorreto"); limite++; return Response.json(true);
    }
    if (r.url.endsWith("/rpc/sso_autorizar_acao")) { afirmar(token === "Bearer token", "capacidade sem JWT"); return Response.json(true); }
    if (r.url.endsWith("/rpc/sso_receber_xlsx_atestado")) { afirmar(token === "Bearer token", "escrita privilegiada"); escrita++; return Response.json({ requestId: pedido, aggregateId: lote, state: "pendente", revision: 1, created: true }); }
    throw new Error("transporte inesperado");
  };
  const resposta = await criarBordaConfigurada(config, transporte)(req(arquivo));
  const corpo = await resposta.json();
  afirmar(resposta.status === 200 && corpo.aggregateId === lote && corpo.state === "pendente" && escrita === 1 && limite === 1, "fluxo incorreto");
});
Deno.test("configuração inválida não libera processamento", async () => {
  let chamadas = 0; const transporte: typeof fetch = () => { chamadas++; throw new Error("não acessar"); };
  const resposta = await criarBordaConfigurada({ ...config, segredo: "curto" }, transporte)(req());
  afirmar(resposta.status === 503 && chamadas === 0, "configuração insegura aceita");
});
Deno.test("erro do limitador ou JWT negado bloqueia antes do processamento", async () => {
  let negocios = 0;
  const tokenNegado: typeof fetch = () => Promise.resolve(Response.json({ error: "invalid" }, { status: 401 }));
  const semIdentidade = await criarBordaConfigurada(config, tokenNegado)(req());
  const limiteFalhou: typeof fetch = (input, init) => { const r = new Request(input, init); if (r.url.endsWith("/auth/v1/user")) return Promise.resolve(Response.json({ id: ator, aud: "authenticated" })); if (r.url.endsWith("/rpc/fn_consumir_rate_limit_webhook")) return Promise.resolve(Response.json({ message: "indisponível" }, { status: 500 })); negocios++; return Promise.resolve(Response.json({})); };
  const semLimite = await criarBordaConfigurada(config, limiteFalhou)(req());
  afirmar(semIdentidade.status === 401 && semLimite.status === 503 && negocios === 0, "falha aberta");
});
Deno.test("Auth indisponível não mantém requisição aberta indefinidamente", async () => {
  const transporte: typeof fetch = (input, init) => {
    const sinal = new Request(input, init).signal;
    return new Promise((_resolve, reject) => { if (sinal.aborted) reject(new Error("abortado")); else sinal.addEventListener("abort", () => reject(new Error("abortado")), { once: true }); });
  };
  const handler = criarBordaConfigurada(config, transporte, 15);
  const resposta = await Promise.race([handler(req()), new Promise<Response>((resolve) => setTimeout(() => resolve(new Response(null, { status: 599 })), 250))]);
  afirmar(resposta.status === 401 || resposta.status === 503, "requisição não expirou com falha fechada");
});
