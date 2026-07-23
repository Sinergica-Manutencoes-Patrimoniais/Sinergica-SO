import { expect, test } from "@playwright/test";

test("exibe produtividade, três fontes, anomalias e salva parâmetros", async ({ page }) => {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByRole("navigation").getByText("Apontamento de Horas", { exact: true }).click();

  await expect(page.getByText("Produtividade e consistência", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Produtividade diária", { exact: true })).toBeVisible();
  await expect(page.getByText("Consistência das fontes", { exact: true })).toBeVisible();
  await expect(page.getByText(/OS abaixo de \d+ min/)).toBeVisible();
  await expect(page.getByText("Horas por cliente", { exact: true })).toBeVisible();

  const tolerancia = page.getByLabel("Tolerância (min)");
  const valorOriginal = await tolerancia.inputValue();
  await tolerancia.fill(valorOriginal === "16" ? "15" : "16");
  await page.getByRole("button", { name: "Salvar parâmetros" }).click();
  await expect(tolerancia).toHaveValue(valorOriginal === "16" ? "15" : "16", { timeout: 10_000 });
});
