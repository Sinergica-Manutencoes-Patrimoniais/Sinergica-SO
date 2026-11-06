import { criarAutorizadorXlsx } from "../functions/_shared/cronograma-xlsx/autorizacao.ts";
const cliente = "16891000-0000-4000-8000-000000000002";
const usuario = "16891000-0000-4000-8000-000000000001";
Deno.test("consulta identidade e capacidade no Cliente com o mesmo Bearer", async () => {
  const chamadas: { url: string; authorization: string | null; body: unknown }[] = [];
  const transporte: typeof fetch = async (input, init) => {
    const req = new Request(input, init); chamadas.push({ url: req.url, authorization: req.headers.get("authorization"), body: req.method === "POST" ? await req.json() : null });
    return Response.json(req.url.endsWith("/auth/v1/user") ? { id: usuario, aud: "authenticated" } : true);
  };
  const autorizar = criarAutorizadorXlsx("https://supabase.invalid", "anonimo-publico", transporte);
  if (!await autorizar("Bearer token-teste", cliente)) throw new Error("acesso válido recusado");
  if (chamadas.length !== 2 || !chamadas[0]?.url.endsWith("/auth/v1/user") || !chamadas[1]?.url.endsWith("/rest/v1/rpc/sso_autorizar_acao")) throw new Error("sequência inválida");
  if (chamadas.some((c) => c.authorization !== "Bearer token-teste")) throw new Error("Bearer não preservado");
  if (JSON.stringify(chamadas[1]?.body) !== JSON.stringify({ p_acao: "plano.gerir", p_cliente_id: cliente })) throw new Error("escopo incorreto");
});
Deno.test("nega identidade inválida antes de consultar capacidade", async () => {
  let chamadas = 0;
  const transporte: typeof fetch = () => { chamadas++; return Promise.resolve(Response.json({ message: "token inválido" }, { status: 401 })); };
  const autorizar = criarAutorizadorXlsx("https://supabase.invalid", "anonimo-publico", transporte);
  if (await autorizar("Bearer invalido", cliente) || chamadas !== 1) throw new Error("token inválido aceito");
});
Deno.test("somente booleano true autoriza", async () => {
  for (const retorno of [false, null, "true", { autorizado: true }]) {
    const transporte: typeof fetch = (input, init) => { const req = new Request(input, init); return Promise.resolve(Response.json(req.url.endsWith("/auth/v1/user") ? { id: usuario, aud: "authenticated" } : retorno)); };
    if (await criarAutorizadorXlsx("https://supabase.invalid", "anonimo-publico", transporte)("Bearer token", cliente)) throw new Error("resposta indevida aceita");
  }
});
Deno.test("falha de rede e erro da RPC não autorizam", async () => {
  for (const falha of ["rede", "rpc"]) {
    const transporte: typeof fetch = (input, init) => { const req = new Request(input, init); if (falha === "rede") return Promise.reject(new Error("segredo")); return Promise.resolve(req.url.endsWith("/auth/v1/user") ? Response.json({ id: usuario, aud: "authenticated" }) : Response.json({ message: "erro" }, { status: 500 })); };
    try { if (await criarAutorizadorXlsx("https://supabase.invalid", "anonimo-publico", transporte)("Bearer token", cliente)) throw new Error("acesso aceito"); } catch (e) { if ((e as Error).message === "acesso aceito") throw e; }
  }
});
Deno.test("erro de rede não registra detalhes sensíveis", async () => {
  const anterior = console.error; const registros: string[] = [];
  console.error = (...args: unknown[]) => { registros.push(args.map(String).join(" ")); };
  try {
    const transporte: typeof fetch = () => Promise.reject(new Error("token-sensivel"));
    await criarAutorizadorXlsx("https://supabase.invalid", "anonimo-publico", transporte)("Bearer token", cliente);
    if (registros.some((item) => item.includes("token-sensivel"))) throw new Error("dados sensíveis em log");
  } finally { console.error = anterior; }
});
