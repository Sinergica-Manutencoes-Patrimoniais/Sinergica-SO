import { expect, test } from "@playwright/test";

test("PCM reorganiza PMOC e Tipos de Tarefa sem grupo Preventivo", async ({ page }) => {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();

  const nav = page.getByRole("navigation");
  await expect(nav.getByText("OPERAÇÃO", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(nav.getByText("CONFIGURAÇÕES", { exact: true })).toBeVisible();
  await expect(nav.getByText("PREVENTIVO", { exact: true })).toHaveCount(0);
  await expect(nav.getByTitle("Cronograma", { exact: true })).toHaveCount(0);
  await expect(nav.getByTitle("Preventivas", { exact: true })).toHaveCount(0);

  await nav.getByTitle("Tipos de Tarefa", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tipos de Tarefa", exact: true })).toBeVisible({
    timeout: 10_000,
  });

  await nav.getByTitle("PMOC", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "PMOC · Climatização", exact: true })).toBeVisible(
    {
      timeout: 10_000,
    },
  );
});
