import { expect, test } from "@playwright/test";

// E01-S73 AC-4: admin de tipos de inspeção + checklist templates (supervisor/superadmin).
test("cria tipo de inspeção e checklist template", async ({ page }) => {
  const nomeTipo = `[TESTE E2E] Tipo ${Date.now()}`;

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Tipos de Inspeção", { exact: true }).click();

  await page.getByRole("button", { name: "Novo tipo" }).click();
  await page.getByLabel("Nome *").fill(nomeTipo);
  await page.getByLabel("Norma técnica").fill("ABNT NBR 16747");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText(nomeTipo, { exact: true })).toBeVisible({ timeout: 10_000 });

  const cardDoTipo = page
    .locator("h4", { hasText: nomeTipo })
    .locator('xpath=ancestor::div[contains(@class,"rounded-[8px]")][1]');
  await cardDoTipo.getByRole("button", { name: "+ Novo checklist" }).click();

  const nomeTemplate = `[TESTE E2E] Checklist ${Date.now()}`;
  await page.getByLabel("Nome do checklist *").fill(nomeTemplate);
  await page.getByPlaceholder("Categoria").fill("Estrutural");
  await page.getByPlaceholder("Elemento").fill("Viga de sustentação");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText(`${nomeTemplate} · 1 item(ns)`)).toBeVisible({ timeout: 10_000 });
});
