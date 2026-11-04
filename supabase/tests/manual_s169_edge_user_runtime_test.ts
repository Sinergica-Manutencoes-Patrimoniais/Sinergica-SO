// Execução local contra edge_xlsx_user_runtime_fixture; não acessa serviços externos.
import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "npm:@zip.js/zip.js@2.24.0";
const url = "http://127.0.0.1:56490";
Deno.test("runtime de usuário mantém recepção fechada sem Worker", async () => {
  const resposta = await fetch(`${url}/`, { method: "POST" });
  const corpo = await resposta.json();
  if (resposta.status !== 503 || corpo.erro !== "recepcao_indisponivel") throw new Error(`Gate incompatível: ${resposta.status} ${JSON.stringify(corpo)}`);
});
Deno.test("runtime de usuário não fornece Worker ao processador", async () => {
  const arquivo = await Deno.readFile("docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  const resposta = await fetch(`${url}/diagnostico`, { method: "POST", body: arquivo });
  const corpo = await resposta.json();
  if (resposta.status !== 500 || corpo.erro !== "ReferenceError: Worker is not defined") throw new Error(`Comportamento mudou: ${resposta.status} ${JSON.stringify(corpo)}`);
});
for (const [nome, linhas] of [["plano-rimini-2026-final.xlsx", 59], ["plano-i-home-2026.xlsx", 53]] as const) {
  Deno.test(`runtime isolado processa diretamente ${nome}`, async () => {
    const arquivo = await Deno.readFile(`docs/planejamento/plano-manutencao/fontes/${nome}`);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", arquivo)), (b) => b.toString(16).padStart(2, "0")).join("");
    const resposta = await fetch(`${url}/diagnostico-direto`, { method: "POST", body: arquivo });
    const corpo = await resposta.json();
    if (resposta.status !== 200 || corpo.estado !== "conferivel" || corpo.linhas !== linhas || corpo.sha256 !== hash || corpo.matriz !== true) throw new Error(`Processamento direto falhou: ${resposta.status} ${JSON.stringify(corpo)}`);
  });
}
Deno.test("runtime isolado rejeita arquivo inválido", async () => {
  const resposta = await fetch(`${url}/diagnostico-direto`, { method: "POST", body: new Uint8Array([1, 2, 3]) });
  if (resposta.status !== 422) throw new Error(`Arquivo inválido: ${resposta.status}`);
});
Deno.test("runtime isolado rejeita expansão acima do limite", async () => {
  const zip = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
  await zip.add("xl/grande.xml", new Uint8ArrayReader(new Uint8Array(4_194_305).fill(65)));
  const resposta = await fetch(`${url}/diagnostico-direto`, { method: "POST", body: await zip.close() });
  if (resposta.status !== 422) throw new Error(`Expansão excessiva: ${resposta.status}`);
});
Deno.test("dois runtimes isolados processam arquivos simultaneamente", async () => {
  const arquivos = await Promise.all(["plano-rimini-2026-final.xlsx", "plano-i-home-2026.xlsx"].map((nome) => Deno.readFile(`docs/planejamento/plano-manutencao/fontes/${nome}`)));
  const respostas = await Promise.all(arquivos.map((arquivo) => fetch(`${url}/diagnostico-direto`, { method: "POST", body: arquivo })));
  const corpos = await Promise.all(respostas.map((r) => r.json()));
  if (respostas.some((r) => r.status !== 200) || corpos[0].linhas !== 59 || corpos[1].linhas !== 53) throw new Error("Processamento concorrente falhou");
});
Deno.test("recepção atestada usa processador Edge e valida recibo em transporte simulado", async () => {
  const arquivo = await Deno.readFile("docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  const resposta = await fetch(`${url}/diagnostico-recepcao`, { method: "POST", body: arquivo });
  const corpo = await resposta.json();
  if (resposta.status !== 200 || corpo.revision !== 1 || corpo.created !== true) throw new Error(`Recepção falhou: ${resposta.status} ${JSON.stringify(corpo)}`);
});
Deno.test("borda experimental processa XLSX e bloqueia identidade, origem e Cliente incorretos", async () => {
  const arquivo = await Deno.readFile("docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  const headers = { origin: "https://sso.example", authorization: "Bearer token", "content-type": "application/octet-stream", "x-cliente-id": "16891000-0000-4000-8000-000000000002", "x-fonte-id": "Rimini", "x-pedido-id": "16900000-0000-4000-8000-000000000301", "x-lote-id": "16900000-0000-4000-8000-000000000302" };
  const enviar = (alteracao: Record<string, string>) => fetch(`${url}/diagnostico-borda`, { method: "POST", headers: { ...headers, ...alteracao }, body: arquivo });
  const valido = await enviar({});
  const corpo = await valido.json();
  if (valido.status !== 200 || corpo.state !== "pendente" || corpo.aggregateId !== headers["x-lote-id"] || valido.headers.get("access-control-allow-origin") !== headers.origin) throw new Error(`Borda: ${valido.status} ${JSON.stringify(corpo)}`);
  for (const [alteracao, esperado] of [[{ authorization: "Bearer invalido" }, 401], [{ origin: "https://outra.example" }, 403], [{ "x-cliente-id": "16891000-0000-4000-8000-000000000003" }, 403]] as const) {
    const negado = await enviar(alteracao);
    if (negado.status !== esperado) throw new Error(`Acesso indevido: ${negado.status}, esperado ${esperado}`);
  }
});
