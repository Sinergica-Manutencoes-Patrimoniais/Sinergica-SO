import { expect, test } from "@playwright/test";

// E03-S11. Depois de desativar o recurso `satisfactions` (pcm-auvo-support-pull) e trocar
// `pcm.satisfacao_respostas` por espelho inativo: o painel de diagnóstico operacional
// (PainelDadosOperacionaisAuvo, dentro do dashboard PCM) precisa mostrar o card de Satisfação como
// "Desativada" — nunca como "0 registros sincronizados", que leria como falha de integração
// (AC-5). O dashboard PCM como um todo precisa continuar carregando sem erro.
test("Card de Satisfação aparece como Desativada no painel PCM, sem erro de console", async ({
  page,
}) => {
  const erros: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") erros.push(msg.text());
  });

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();

  const cardSatisfacao = page
    .locator("div")
    .filter({ has: page.getByText("Satisfação", { exact: true }) })
    .filter({ has: page.getByText("Desativada", { exact: true }) })
    .first();
  await expect(cardSatisfacao).toBeVisible({ timeout: 15_000 });
  await expect(cardSatisfacao).not.toContainText("registros sincronizados");

  expect(erros, `Erros de console: ${erros.join("\n")}`).toEqual([]);
});
