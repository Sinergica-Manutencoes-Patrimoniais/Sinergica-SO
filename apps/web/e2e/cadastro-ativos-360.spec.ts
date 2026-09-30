import { expect, test } from "@playwright/test";
import { softDeletePorNome } from "./helpers/limpeza-e2e";

let cliente: string | null = null;
let componente: string | null = null;
let categoria: string | null = null;

test.afterEach(async ({ page }) => {
  if (componente) await softDeletePorNome(page, "pcm", "equipamentos", componente);
  if (categoria) await softDeletePorNome(page, "pcm", "equipamento_categorias", categoria);
  if (cliente) await softDeletePorNome(page, "pcm", "clientes", cliente);
  cliente = null;
  componente = null;
  categoria = null;
});

test("Visão 360 cadastra e edita Componente sem sair do cliente (E01-S159)", async ({ page }) => {
  const sufixo = Date.now();
  cliente = `[TESTE E2E] Cliente 360 ${sufixo}`;
  componente = `Bomba 360 ${sufixo}`;
  categoria = `Categoria 360 ${sufixo}`;

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).click();
  await page.getByRole("button", { name: "Novo cliente" }).click();
  await page.getByLabel("Nome *").fill(cliente);
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByPlaceholder("Buscar por cliente, cidade, contato, CNPJ ou ID Auvo").fill(cliente);
  await page.getByText(cliente, { exact: true }).first().click();
  await page.getByRole("button", { name: "Ativos", exact: true }).click();

  await page.getByRole("button", { name: "Novo componente" }).click();
  await page.getByRole("button", { name: "+ Nova categoria" }).click();
  await page.getByLabel("Nome *").last().fill(categoria);
  await page.getByLabel("Nome *").last().blur();
  await page.getByRole("button", { name: "Criar" }).click();
  await page.getByLabel("Nome *").first().fill(componente);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(componente, { exact: true })).toBeVisible({ timeout: 10_000 });

  await page
    .getByText(componente, { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'py-3')][1]")
    .getByRole("button", { name: "Editar" })
    .click();
  await page.getByLabel("Nome *").fill(`${componente} editada`);
  componente = `${componente} editada`;
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(componente, { exact: true })).toBeVisible({ timeout: 10_000 });
});
