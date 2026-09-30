import { expect, test } from "@playwright/test";
import { softDeletePorNome } from "./helpers/limpeza-e2e";

let cliente: string | null = null;

test.afterEach(async ({ page }) => {
  if (cliente) await softDeletePorNome(page, "pcm", "clientes", cliente);
  cliente = null;
});

test("Árvore da Visão 360 expande a estrutura, filtra e recolhe (E01-S160)", async ({ page }) => {
  const sufixo = Date.now();
  cliente = `[TESTE E2E] Cliente árvore ${sufixo}`;
  const area = `Torre árvore ${sufixo}`;
  const local = `Sala árvore ${sufixo}`;
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).click();
  await page.getByRole("button", { name: "Novo cliente" }).click();
  await page.getByLabel("Nome *").fill(cliente);
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByPlaceholder("Buscar por cliente, cidade, contato, CNPJ ou ID Auvo").fill(cliente);
  await page.getByText(cliente, { exact: true }).first().click();
  await page.getByRole("button", { name: "Estrutura", exact: true }).click();
  await page.getByRole("button", { name: "Nova Área" }).click();
  await page.getByLabel("Nome *").fill(area);
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByRole("button", { name: "Local", exact: true }).click();
  await page.getByLabel("Nome *").fill(local);
  await page.getByRole("button", { name: "Salvar" }).click();

  await page.getByRole("button", { name: "Árvore", exact: true }).click();
  await expect(page.getByText(area, { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Expandir tudo" }).click();
  await expect(page.getByText(local, { exact: true })).toBeVisible();
  await page.getByPlaceholder("Buscar na árvore").fill("Sala");
  await expect(page.getByText(local, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Recolher tudo" }).click();
});
