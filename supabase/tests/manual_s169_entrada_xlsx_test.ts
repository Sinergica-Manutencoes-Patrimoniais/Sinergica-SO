import { criarEntradaXlsx } from "../functions/pcm-cronograma-xlsx-receber/entrada.ts";

const valores: Record<string, string> = { SUPABASE_URL: "https://supabase.invalid", SUPABASE_ANON_KEY: "publica", SUPABASE_SERVICE_ROLE_KEY: "servico", SSO_XLSX_ATTEST_KEY: "07".repeat(32), SSO_XLSX_CORS_ALLOWED_ORIGINS: "https://sso.example", SSO_XLSX_RECEPCAO_ENABLED: "true" };
const req = () => new Request("https://edge.invalid/", { method: "POST", headers: { origin: "https://sso.example", authorization: "Bearer token", "content-type": "application/octet-stream", "x-cliente-id": "16891000-0000-4000-8000-000000000002", "x-fonte-id": "Rimini", "x-pedido-id": "16900000-0000-4000-8000-000000000301", "x-lote-id": "16900000-0000-4000-8000-000000000302" }, body: new Uint8Array([1]) });
function afirmar(ok: boolean, msg: string) { if (!ok) throw new Error(msg); }
Deno.test("sem flag literal true, entrada permanece bloqueada", async () => {
  for (const flag of [undefined, "TRUE", "1", "false"]) {
    let chamadas = 0; const env = { ...valores, SSO_XLSX_RECEPCAO_ENABLED: flag };
    const resposta = await criarEntradaXlsx((nome) => env[nome as keyof typeof env], () => { chamadas++; throw new Error("rede"); })(req());
    afirmar(resposta.status === 503 && chamadas === 0, "flag abriu função");
  }
});
Deno.test("ausência de segredo, origens ou chave de serviço bloqueia sem rede", async () => {
  for (const nome of ["SSO_XLSX_ATTEST_KEY", "SSO_XLSX_CORS_ALLOWED_ORIGINS", "SUPABASE_SERVICE_ROLE_KEY"]) {
    let chamadas = 0; const env = { ...valores, [nome]: "" };
    const resposta = await criarEntradaXlsx((chave) => env[chave], () => { chamadas++; throw new Error("rede"); })(req());
    afirmar(resposta.status === 503 && chamadas === 0, "configuração incompleta aceita");
  }
});
Deno.test("aceita chave de serviço por mapa JSON sem expor credencial", async () => {
  const env = { ...valores, SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_SECRET_KEYS: JSON.stringify({ default: "segredo-interno" }) };
  const transporte: typeof fetch = (input, init) => { const r = new Request(input, init); if (r.url.endsWith("/auth/v1/user")) return Promise.resolve(Response.json({ id: "16891000-0000-4000-8000-000000000001", aud: "authenticated" })); if (r.url.endsWith("/rpc/fn_consumir_rate_limit_webhook")) { afirmar(r.headers.get("authorization") === "Bearer segredo-interno", "chave de serviço errada"); return Promise.resolve(Response.json(false)); } throw new Error("rota inesperada"); };
  const resposta = await criarEntradaXlsx((chave) => env[chave as keyof typeof env], transporte)(req());
  afirmar(resposta.status === 429 && !(await resposta.text()).includes("segredo-interno"), "segredo exposto ou limite ignorado");
});
Deno.test("HTTP local responde bloqueado sem configuração", async () => {
  const servidor = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen: () => {} }, criarEntradaXlsx(() => undefined));
  try {
    const endereco = servidor.addr as Deno.NetAddr;
    const resposta = await fetch(`http://127.0.0.1:${endereco.port}/`, { method: "POST", body: "teste" });
    afirmar(resposta.status === 503 && (await resposta.json()).erro === "recepcao_indisponivel", "HTTP abriu sem configuração");
  } finally { await servidor.shutdown(); }
});
