import { expect, test } from "@playwright/test";
import { softDeletePorNome } from "./helpers/limpeza-e2e";

// E01-S146: este spec criava `[TESTE E2E] Cliente S91 <timestamp>` sem nunca limpar — achado real
// de 56 clientes acumulados em produção (2026-08-12). `afterEach` soft-deleta o cliente desta
// execução (mesmo padrão do botão "Excluir" de Clientes).
let clienteCriado: string | null = null;

test.afterEach(async ({ page }) => {
  if (!clienteCriado) return;
  await softDeletePorNome(page, "pcm", "clientes", clienteCriado);
});

test("gerencia marcação, atribui ao cliente, filtra e exibe na Visão 360", async ({ page }) => {
  const sufixo = Date.now();
  const nomeMarcacao = `[TESTE E2E] S91 ${sufixo}`;
  const nomeEditado = `${nomeMarcacao} editada`;
  const nomeCliente = `[TESTE E2E] Cliente S91 ${sufixo}`;
  clienteCriado = nomeCliente;

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByRole("navigation").getByText("Marcações de Cliente", { exact: true }).click();

  await page.getByRole("button", { name: "Nova marcação" }).click();
  await page.getByLabel("Nome *").fill(nomeMarcacao);
  await page.getByLabel("Cor *").fill("#7c3aed");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(nomeMarcacao, { exact: true })).toBeVisible({ timeout: 10_000 });

  const linhaMarcacao = page.getByText(nomeMarcacao, { exact: true }).locator("..");
  await linhaMarcacao.getByTitle("Editar").click();
  await page.getByLabel("Nome *").fill(nomeEditado);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(nomeEditado, { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("navigation").getByText("Clientes", { exact: true }).click();
  await page.getByRole("button", { name: "Novo cliente" }).click();
  await page.getByLabel("Nome *").fill(nomeCliente);
  await page.getByRole("button", { name: "Salvar" }).click();

  const busca = page.getByPlaceholder("Buscar por cliente, cidade, contato, CNPJ ou ID Auvo");
  await busca.fill(nomeCliente);
  const linhaCliente = page.getByRole("row").filter({ hasText: nomeCliente });
  await expect(linhaCliente).toBeVisible({ timeout: 10_000 });
  await linhaCliente.locator("select").selectOption({ label: nomeEditado });
  await expect(linhaCliente.locator("select")).toHaveValue(/.+/);

  await busca.fill("");
  await page.getByLabel("Marcação").selectOption({ label: nomeEditado });
  await expect(page.getByText(nomeCliente, { exact: true })).toBeVisible();
  await expect(page.getByText(/1 de .* cadastro\(s\) visíveis/)).toBeVisible();

  await page.getByText(nomeCliente, { exact: true }).click();
  await expect(page.getByText(nomeEditado, { exact: true })).toBeVisible({ timeout: 10_000 });
});
