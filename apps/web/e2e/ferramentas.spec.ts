import { expect, test } from "@playwright/test";

// E01-S63: unidade individual + código FER-NNNN (valida também o fix de grant da sequence,
// migration 0093 — mesmo bug achado em pcm.inspecao_codigo_seq).
test("cria ferramenta e gera unidades com código FER-NNNN", async ({ page }) => {
  const nome = `[TESTE E2E] Ferramenta ${Date.now()}`;

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Ferramentas", { exact: true }).click();

  await page.getByRole("button", { name: "Nova ferramenta" }).click();
  await page.getByLabel("Nome *").fill(nome);
  await page.getByLabel("Quantidade total").fill("2");
  await page.getByRole("button", { name: "Salvar" }).click();

  const card = page
    .locator("h4", { hasText: nome })
    .locator('xpath=ancestor::div[contains(@class,"rounded-[8px]")][1]');
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.getByText("0 unidade(s)").click();
  await card.getByRole("button", { name: /Gerar/ }).click();

  await expect(card.getByText(/FER-\d{4}/).first()).toBeVisible({ timeout: 10_000 });
  await expect(card.getByText(/FER-\d{4}/)).toHaveCount(2);
});
