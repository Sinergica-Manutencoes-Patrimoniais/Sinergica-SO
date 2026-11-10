// Exclusivamente runtime isolado com fixture: nenhuma chamada externa ou credencial real.
const url = "http://127.0.0.1:56489/";
Deno.test("Edge Runtime sem Worker permanece fechado mesmo com flag habilitada", async () => {
  const resposta = await fetch(url, { method: "POST" });
  const dados = await resposta.json();
  if (resposta.status !== 503 || dados.erro !== "recepcao_indisponivel") throw new Error(`Gate incompatível: ${resposta.status} ${JSON.stringify(dados)}`);
});
Deno.test("Edge Runtime processa Rimini com worker e retorna recibo simulado", async () => {
  const arquivo = await Deno.readFile("docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  const resposta = await fetch(url, { method: "POST", headers: { origin: "https://sso.example", authorization: "Bearer token", "content-type": "application/octet-stream", "x-cliente-id": "16891000-0000-4000-8000-000000000002", "x-fonte-id": "Rimini", "x-pedido-id": "16900000-0000-4000-8000-000000000301", "x-lote-id": "16900000-0000-4000-8000-000000000302" }, body: arquivo });
  const dados = await resposta.json();
  if (resposta.status !== 200 || dados.aggregateId !== "16900000-0000-4000-8000-000000000302" || dados.state !== "pendente") throw new Error(`Edge recusou processamento: ${resposta.status} ${JSON.stringify(dados)}`);
});
