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

  // E01-S75: Ferramentas virou lista densa (linha por ferramenta, sem card) — a linha é o
  // ancestral `div.py-2.5` mais próximo do nome (só a linha tem essa classe).
  const linha = page
    .getByText(nome, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"py-2.5")][1]');
  await expect(linha).toBeVisible({ timeout: 10_000 });
  await linha.getByText(nome, { exact: true }).click();
  await linha.getByRole("button", { name: /Gerar/ }).click();

  await expect(linha.getByText(/FER-\d{4}/).first()).toBeVisible({ timeout: 10_000 });
  await expect(linha.getByText(/FER-\d{4}/)).toHaveCount(2);
});
