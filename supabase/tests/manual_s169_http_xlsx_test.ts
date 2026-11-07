import { prepararRecepcaoXlsx } from "../functions/_shared/cronograma-xlsx/preparar-http.ts";
import { processarXlsxIsolado } from "../functions/_shared/cronograma-xlsx/processar-isolado.ts";
import { criarAutorizadorXlsx } from "../functions/_shared/cronograma-xlsx/autorizacao.ts";

const cliente = "16891000-0000-4000-8000-000000000002";
const headers = { authorization: "Bearer token", "content-type": "application/octet-stream", "x-cliente-id": cliente, "x-fonte-id": "Rimini" };
const pedido = (bytes: Uint8Array, extras: Record<string,string> = {}) => new Request("http://localhost/", { method: "POST", headers: { ...headers, ...extras }, body: new Uint8Array(bytes).buffer });
function dependencias(permitido: boolean) {
  let processados = 0;
  return { autorizar: async () => permitido, processar: async (bytes: Uint8Array) => { processados++; if (bytes.length !== 3 || bytes[0] !== 1) throw new Error("bytes divergentes"); return { estado: "conferivel" as const, linhas: 59, sha256: "a".repeat(64) }; }, contagem: () => processados };
}
Deno.test("recusa acesso antes de ler o corpo", async () => {
  const deps = dependencias(false); const req = pedido(new Uint8Array([1,2,3]));
  const resposta = await prepararRecepcaoXlsx(req, deps);
  if (resposta.status !== 403 || req.bodyUsed || deps.contagem()) throw new Error("acesso não bloqueado");
});
Deno.test("processa bytes autorizados sem expor matriz ou arquivo", async () => {
  const deps = dependencias(true); const resposta = await prepararRecepcaoXlsx(pedido(new Uint8Array([1,2,3])), deps);
  const corpo = await resposta.json();
  if (resposta.status !== 200 || corpo.estado !== "conferivel" || corpo.linhas !== 59 || corpo.sha256 !== "a".repeat(64) || "matriz" in corpo || "bytes" in corpo || deps.contagem() !== 1) throw new Error("resposta inválida");
});
Deno.test("decodifica fonte UTF-8 sem alterar caracteres e recusa headers ambíguos", async () => {
  const base = { authorization: "Bearer token", "content-type": "application/octet-stream", "x-cliente-id": cliente };
  const montar = (fonte: Record<string, string>) => new Request("http://localhost/", { method: "POST", headers: { ...base, ...fonte }, body: new Uint8Array([1,2,3]) });
  let recebida = "";
  const deps = { autorizar: async () => true, processar: async (_bytes: Uint8Array, fonte: string) => { recebida = fonte; return { estado: "conferivel" as const, linhas: 1, sha256: "a".repeat(64) }; } };
  const correta = await prepararRecepcaoXlsx(montar({ "x-fonte-id-utf8": "S%C3%A3o%20Jo%C3%A3o%20%E2%80%94%20Torre%20A" }), deps);
  if (correta.status !== 200 || recebida !== "São João — Torre A") throw new Error("Fonte alterada.");
  const invalidas: Record<string, string>[] = [{ "x-fonte-id": "A", "x-fonte-id-utf8": "A" }, { "x-fonte-id-utf8": "%ZZ" }, { "x-fonte-id-utf8": "%00" }, { "x-fonte-id-utf8": "%41" }];
  for (const invalida of invalidas) {
    const r = await prepararRecepcaoXlsx(montar(invalida), deps);
    if (r.status !== 400) throw new Error("Fonte ambígua aceita.");
  }
});
Deno.test("recusa tamanho declarado ou real acima do limite", async () => {
  const deps = dependencias(true);
  const declarado = await prepararRecepcaoXlsx(pedido(new Uint8Array([1]), { "content-length": "5242881" }), deps);
  const real = await prepararRecepcaoXlsx(pedido(new Uint8Array(5_242_881)), deps);
  if (declarado.status !== 413 || real.status !== 413 || deps.contagem()) throw new Error("limite ignorado");
});
Deno.test("recusa método, credenciais e metadados inválidos", async () => {
  const deps = dependencias(true);
  const casos = [new Request("http://localhost/"), pedido(new Uint8Array([1]), { authorization: "" }), pedido(new Uint8Array([1]), { "x-cliente-id": "inválido" }), pedido(new Uint8Array([1]), { "content-type": "application/json" })];
  for (const caso of casos) if ((await prepararRecepcaoXlsx(caso, deps)).ok) throw new Error("requisição inválida aceita");
  if (deps.contagem()) throw new Error("processamento inesperado");
});
Deno.test("erro interno não expõe conteúdo", async () => {
  const resposta = await prepararRecepcaoXlsx(pedido(new Uint8Array([1,2,3])), { autorizar: async () => true, processar: async () => { throw new Error("segredo da planilha"); } });
  if (resposta.status !== 422 || (await resposta.text()).includes("segredo")) throw new Error("erro exposto");
});
Deno.test("cancelamento interrompe corpo parado e não inicia processamento", async () => {
  const deps = dependencias(true); const controle = new AbortController();
  let cancelado = false; let fluxo!: ReadableStreamDefaultController<Uint8Array>;
  const corpo = new ReadableStream<Uint8Array>({ start(c) { fluxo = c; }, cancel() { cancelado = true; } });
  const req = new Request("http://localhost/", { method: "POST", headers, body: corpo, signal: controle.signal });
  const pendente = prepararRecepcaoXlsx(req, deps);
  await new Promise((resolve) => setTimeout(resolve, 5)); controle.abort();
  const resultado = await Promise.race([pendente, new Promise<null>((resolve) => setTimeout(() => resolve(null), 100))]);
  if (!resultado) { fluxo.close(); await pendente; throw new Error("leitura não foi interrompida"); }
  if (resultado.ok || !cancelado || deps.contagem()) throw new Error("cancelamento não impediu processamento");
});
Deno.test("prazo encerra corpo que nunca termina", async () => {
  const deps = dependencias(true); let cancelado = false;
  const corpo = new ReadableStream<Uint8Array>({ cancel() { cancelado = true; } });
  const req = new Request("http://localhost/", { method: "POST", headers, body: corpo });
  const resposta = await prepararRecepcaoXlsx(req, deps);
  if (resposta.status !== 408 || !cancelado || deps.contagem()) throw new Error("prazo de leitura ignorado");
});
Deno.test("integra fronteira HTTP e worker real sem persistir", async () => {
  const bytes = await Deno.readFile("docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  const transporte: typeof fetch = (input, init) => {
    const req = new Request(input, init);
    return Promise.resolve(Response.json(req.url.endsWith("/auth/v1/user") ? { id: "16891000-0000-4000-8000-000000000001", aud: "authenticated" } : true));
  };
  const resposta = await prepararRecepcaoXlsx(pedido(bytes), {
    autorizar: criarAutorizadorXlsx("https://supabase.invalid", "anonimo-publico", transporte),
    processar: async (arquivo, fonte, clienteId, signal) => {
      const resultado = await processarXlsxIsolado(arquivo, fonte, clienteId, signal);
      return { estado: resultado.previa.estado, linhas: resultado.previa.estado === "conferivel" ? resultado.previa.linhas.length : 0, sha256: resultado.sha256 };
    },
  });
  const corpo = await resposta.json();
  if (resposta.status !== 200 || corpo.estado !== "conferivel" || corpo.linhas !== 59 || "matriz" in corpo) throw new Error("integração divergente");
});
