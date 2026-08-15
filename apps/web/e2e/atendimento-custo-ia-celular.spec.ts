import { expect, test } from "@playwright/test";

// E02-S32/E02-S33: regressão — `MensagemItem` ganhou `origemEnvio`/`custoIa` (novas colunas
// `atendimento.mensagens.origem_envio` + join com `config.ia_gasto_log`). Este smoke garante que
// o Inbox real (conversas de produção, sem seed) continua renderizando sem erro de console com o
// adapter/tipo novo — não afirma que uma bolha específica tem o selo 📱 ou o rodapé de custo (não
// há garantia de que produção já tenha uma mensagem desse tipo no momento do teste).
test("Inbox de Atendimento carrega conversas e mensagens sem erro, com os campos novos de S32/S33", async ({
  page,
}) => {
  const erros: string[] = [];
  page.on("pageerror", (err) => erros.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") erros.push(msg.text());
  });

  await page.goto("/");
  await page.getByText("Atendimento · Zé", { exact: true }).first().click();

  await expect(page.getByRole("navigation").getByText("Inbox", { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  const primeiraConversa = page.locator(".flex-1.overflow-y-auto > button").first();
  if (await primeiraConversa.count().then((n) => n > 0)) {
    await primeiraConversa.click();
    await page.waitForTimeout(1500);
  }

  expect(erros, `Erros de console: ${erros.join("\n")}`).toEqual([]);
});
