import { expect, test } from "@playwright/test";

// E02-S31 AC-1/AC-2: Configurações > IA ganha o campo de limite de quota mensal, e Configurações >
// Gasto de IA é o dashboard novo (KPIs por módulo, histórico). Smoke read-only — não altera a
// credencial real do OpenRouter nem o limite de quota já configurado em produção.
test("Configurações > IA mostra o campo de limite de quota mensal", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.getByRole("navigation").getByText("IA", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "IA", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Limite de quota mensal (USD)")).toBeVisible();
});

test("Configurações > Gasto de IA mostra dashboard por módulo e histórico", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.getByRole("navigation").getByText("Gasto de IA", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Gasto de IA" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Total do mês")).toBeVisible();
  await expect(page.getByText("Inspeção", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Atendimento", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Previsões", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Histórico \(últimas 50\)/)).toBeVisible();
});
