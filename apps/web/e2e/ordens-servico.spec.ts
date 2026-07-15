import { expect, test } from "@playwright/test";

// E01-S69: OS clicável e editável. Cria uma OS de teste (prefixo [TESTE E2E], limpa via
// scripts/e2e-cleanup.mjs depois), edita o título e confirma que a mudança persiste.
test("cria OS, abre detalhe e edita", async ({ page }) => {
  const titulo = `[TESTE E2E] OS ${Date.now()}`;
  const tituloEditado = `${titulo} (editado)`;

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Ordens de Serviço", { exact: true }).click();

  await page.getByRole("button", { name: "Nova OS" }).click();
  await page.getByPlaceholder("Ex: Reparo vazamento tubulação — Térreo").fill(titulo);
  await page
    .getByPlaceholder("Descreva o problema, evidências, restrições de acesso e contexto relevante.")
    .fill("Criada por teste automatizado (Playwright, E01-S69).");
  await page.getByRole("button", { name: "Criar OS" }).click();

  await expect(page.getByRole("button", { name: "Nova OS" })).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder("Buscar por número, cliente ou título").fill(titulo);
  await expect(page.getByText(titulo, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.getByText(titulo, { exact: true }).first().click();

  await expect(page.getByRole("heading", { name: titulo })).toBeVisible();

  await page.getByRole("button", { name: "Editar" }).click();
  const campoTitulo = page.getByPlaceholder("Ex: Reparo vazamento tubulação — Térreo");
  await expect(campoTitulo).toHaveValue(titulo);
  await campoTitulo.fill(tituloEditado);
  await page.getByRole("button", { name: "Salvar alterações" }).click();

  await expect(page.getByRole("heading", { name: tituloEditado })).toBeVisible({ timeout: 10_000 });
});
