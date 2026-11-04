// Executar somente com fixture descartável e função 0146 carregada, sem serviços externos.
import { criarBordaConfigurada } from "../functions/_shared/cronograma-xlsx/borda-configurada.ts";
const socket = Deno.env.get("SSO_RATE_TEST_SOCKET") ?? "";
if (!/^\/tmp\/sso-recuperacao-pg\.[A-Za-z0-9]+$/.test(socket)) throw new Error("Socket descartável inválido.");
const ator = crypto.randomUUID();
const config = { habilitado: true, url: "https://supabase.invalid", publica: "publica", servico: "servico", segredo: "07".repeat(32), origens: ["https://sso.example"] };
const headers = { origin: "https://sso.example", authorization: "Bearer token", "content-type": "application/octet-stream", "x-cliente-id": "16891000-0000-4000-8000-000000000002", "x-fonte-id": "Rimini", "x-pedido-id": "16900000-0000-4000-8000-000000000301", "x-lote-id": "16900000-0000-4000-8000-000000000302" };
async function consumir(): Promise<boolean> {
  const sql = `set test.role='service_role'; set role service_role; select atendimento.fn_consumir_rate_limit_webhook('xlsx-cronograma:${ator}',10,60);`;
  const processo = new Deno.Command("/opt/homebrew/bin/psql", { args: ["-h", socket, "-p", "56481", "-d", "sso_s169_descartavel", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], stdin: "piped", stdout: "piped", stderr: "piped" }).spawn();
  const escritor = processo.stdin.getWriter(); await escritor.write(new TextEncoder().encode(sql)); await escritor.close();
  const resultado = await processo.output(); if (!resultado.success) throw new Error("Limite SQL indisponível.");
  const texto = new TextDecoder().decode(resultado.stdout).trim();
  if (texto !== "t" && texto !== "f") throw new Error("Resposta SQL inválida.");
  return texto === "t";
}
Deno.test("limite real do banco é consumido pela borda antes do worker", async () => {
  let processamento = 0;
  const transporte: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    if (req.url.endsWith("/auth/v1/user")) return Response.json({ id: ator, aud: "authenticated" });
    if (req.url.endsWith("/rpc/fn_consumir_rate_limit_webhook")) {
      const dados = await req.json();
      if (req.headers.get("authorization") !== "Bearer servico" || dados.p_chave !== `xlsx-cronograma:${ator}` || dados.p_limite !== 10 || dados.p_janela_segundos !== 60) throw new Error("Limite divergente.");
      return Response.json(await consumir());
    }
    if (req.url.endsWith("/rpc/sso_autorizar_acao")) { processamento++; return Response.json(true); }
    throw new Error("Chamada inesperada.");
  };
  const borda = criarBordaConfigurada(config, transporte);
  for (let i = 0; i < 10; i++) {
    const resposta = await borda(new Request("https://edge.invalid", { method: "POST", headers, body: new Uint8Array([1, 2, 3]) }));
    if (resposta.status === 429) throw new Error("Bloqueio antecipado.");
  }
  const bloqueada = await borda(new Request("https://edge.invalid", { method: "POST", headers, body: new Uint8Array([1, 2, 3]) }));
  // Autorização é consultada na borda e novamente pelo serviço atestado.
  if (bloqueada.status !== 429 || processamento !== 20) throw new Error(`Limite real ignorado: status ${bloqueada.status}, consultas ${processamento}.`);
});
