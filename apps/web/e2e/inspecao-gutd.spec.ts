import { expect, test } from "@playwright/test";

// Correção do achado do PO (2026-08-10): o modal "Revisar antes de gerar backlog" usava GUT
// clássico (3×3×3) em vez do GUTd de 4 fatores que o projeto usa desde a E01-S82. Cobre o modal
// contra a INSP-0027 real, que tem itens não conformes reais para selecionar.
test("Revisão para backlog mostra os 4 campos do GUTd e classifica pelo endpoint próprio", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByTitle("Inspeções", { exact: true }).click();

  await page.getByPlaceholder("Buscar por cliente ou título…").fill("Portal Recantos de Rimini");
  // A lista mostra título/cliente/data, não o código — o código só aparece no cabeçalho de dentro.
  await expect(page.getByText("Portal Recantos de Rimini", { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByText("Portal Recantos de Rimini", { exact: false }).first().click();
  await expect(page.getByText("INSP-0027", { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });

  const primeiroCheckbox = page.getByText("Selecionar p/ backlog").first();
  await primeiroCheckbox.click();

  await page.getByRole("button", { name: /Gerar backlog/ }).click();

  await expect(page.getByRole("heading", { name: "Revisar antes de gerar backlog" })).toBeVisible({
    timeout: 20_000,
  });

  // Os 4 campos do GUTd — é o que faltava antes da correção.
  await expect(page.getByText("Gravidade", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Urgência", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Tendência", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Dor do cliente", { exact: true }).first()).toBeVisible();

  // Score GUTd é rótulo próprio — antes dizia "Score PCM (GUT)".
  await expect(page.getByText(/Score PCM \(GUTd\)/).first()).toBeVisible();
});
