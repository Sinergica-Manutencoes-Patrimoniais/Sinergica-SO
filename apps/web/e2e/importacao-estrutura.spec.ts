import { expect, test } from "@playwright/test";
import { softDeletePorNome } from "./helpers/limpeza-e2e";

let cliente: string | null = null;

test.afterEach(async ({ page }) => {
  if (cliente) await softDeletePorNome(page, "pcm", "clientes", cliente);
  cliente = null;
});

test("estrutura exportada volta como simulação sem alterações (E01-S161 AC-2)", async ({
  page,
}) => {
  cliente = `[TESTE E2E] Cliente importação ${Date.now()}`;
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).click();
  await page.getByRole("button", { name: "Novo cliente" }).click();
  await page.getByLabel("Nome *").fill(cliente);
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByPlaceholder("Buscar por cliente, cidade, contato, CNPJ ou ID Auvo").fill(cliente);
  await page.getByText(cliente, { exact: true }).first().click();
  await page.getByRole("button", { name: "Estrutura", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar Excel" }).click();
  const caminhoArquivo = await (await downloadPromise).path();
  if (!caminhoArquivo) throw new Error("A exportação não gerou arquivo temporário.");
  await page.getByRole("button", { name: "Importar Excel" }).click();
  await page.locator('input[type="file"]').setInputFiles(caminhoArquivo);
  await expect(page.getByText(/0 criar · 0 editar · 0 excluir/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Executar" })).toBeDisabled();
});
