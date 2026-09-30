import { type Locator, expect, test } from "@playwright/test";
import { softDeletePorNome } from "./helpers/limpeza-e2e";

async function selecionarPorTexto(select: Locator, textoParcial: string) {
  await expect
    .poll(async () =>
      (await select.locator("option").allTextContents()).some((opcao) =>
        opcao.includes(textoParcial),
      ),
    )
    .toBe(true);
  const opcao = (await select.locator("option").allTextContents()).find((texto) =>
    texto.includes(textoParcial),
  );
  if (!opcao) throw new Error(`Opção contendo "${textoParcial}" não encontrada`);
  await select.selectOption({ label: opcao });
}

let nomes: {
  cliente: string;
  area: string;
  local: string;
  categoria: string;
  item: string;
} | null = null;

test.afterEach(async ({ page }) => {
  if (!nomes) return;
  await softDeletePorNome(page, "pcm", "equipamentos", nomes.item);
  await softDeletePorNome(page, "pcm", "locais", nomes.local);
  await softDeletePorNome(page, "pcm", "areas", nomes.area);
  await softDeletePorNome(page, "pcm", "equipamento_categorias", nomes.categoria);
  await softDeletePorNome(page, "pcm", "clientes", nomes.cliente);
});

test("Identificador: reserva sequencial e confirmação para alterar", async ({ page }) => {
  const sufixo = Date.now();
  nomes = {
    cliente: `[TESTE E2E] Cliente ID ${sufixo}`,
    area: `Torre ${sufixo}`,
    local: `Sala ${sufixo}`,
    categoria: `[TESTE E2E] Categoria ID ${sufixo}`,
    item: `[TESTE E2E] Bomba ID ${sufixo}`,
  };

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).click();
  await page.getByRole("button", { name: "Novo cliente" }).click();
  await page.getByLabel("Nome *").fill(nomes.cliente);
  await page.getByLabel("Sigla").blur();
  await page.getByRole("button", { name: "Salvar" }).click();
  await page
    .getByPlaceholder("Buscar por cliente, cidade, contato, CNPJ ou ID Auvo")
    .fill(nomes.cliente);
  await page.getByText(nomes.cliente, { exact: true }).first().click();

  await page.getByText("Estrutura", { exact: true }).click();
  await page.getByRole("button", { name: "Nova Área" }).click();
  await page.getByLabel("Nome *").fill(nomes.area);
  await page.getByLabel("Sigla").blur();
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByRole("button", { name: "Local", exact: true }).click();
  await page.getByLabel("Nome *").fill(nomes.local);
  await page.getByLabel("Sigla").blur();
  await page.getByRole("button", { name: "Salvar" }).click();

  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Componentes", { exact: true }).click();
  await page.getByRole("button", { name: "Novo componente" }).click();
  await page.getByRole("button", { name: "+ Nova categoria" }).click();
  await page.getByLabel("Nome *").last().fill(nomes.categoria);
  await page.getByLabel("Nome *").last().blur();
  await page.getByRole("button", { name: "Criar" }).click();
  await page.getByLabel("Nome *").first().fill(nomes.item);
  await selecionarPorTexto(page.getByLabel("Cliente"), nomes.cliente);
  await selecionarPorTexto(page.getByLabel("Local (AC-4)"), nomes.local);
  await expect(page.getByLabel("Identificador")).toHaveValue(/-##$/);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(nomes.item, { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(/-01$/, { exact: false }).first()).toBeVisible();

  await page.getByRole("button", { name: "Novo componente" }).click();
  await page.getByLabel("Nome *").fill(nomes.item);
  await selecionarPorTexto(page.getByLabel("Cliente"), nomes.cliente);
  await selecionarPorTexto(page.getByLabel("Local (AC-4)"), nomes.local);
  await selecionarPorTexto(page.getByLabel("Categoria"), nomes.categoria);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(/-02$/, { exact: false }).first()).toBeVisible({ timeout: 10_000 });

  const linha = page
    .getByText(nomes.item, { exact: true })
    .first()
    .locator("xpath=ancestor::div[contains(@class, 'py-2.5')][1]");
  await linha.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("button", { name: "Editar identificador" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Etiquetas já impressas deixarão de corresponder",
  );
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByLabel("Identificador")).not.toHaveAttribute("readonly");
});
