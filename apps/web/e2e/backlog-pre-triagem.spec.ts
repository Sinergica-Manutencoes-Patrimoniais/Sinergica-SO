import { expect, test } from "@playwright/test";

// E01-S151: item de backlog criado manual (sem técnico) nasce sem Chamado ("Aguardando triagem"),
// "Confirmar chamado" promove pra CH-XXXX real. Dados ficam marcados [TESTE E2E] e são apagados
// via SQL direto ao final (o botão "Descartar" só cancela — não some da tabela).
test("Backlog: item nasce sem Chamado, Confirmar chamado promove pra CH-XXXX real", async ({
  page,
}) => {
  const titulo = `[TESTE E2E] backlog pré-triagem ${Date.now()}`;

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByRole("navigation").getByText("Chamados", { exact: true }).click();
  await page.getByRole("button", { name: "Backlog", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Backlog GUT" })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: "Novo item de backlog" }).click();
  await expect(page.getByRole("heading", { name: "Nova Ordem de Serviço" })).toBeVisible();

  const clienteSelect = page.locator("div:has(> span:text-is('Cliente *')) select");
  await clienteSelect.selectOption({ index: 1 });
  await page.locator("div:has(> span:text-is('Título *')) input").fill(titulo);
  // Técnico e data ficam em branco de propósito — é isso que testa o AC-1 (nasce sem Chamado).

  await page.getByRole("button", { name: "Criar OS" }).click();
  await expect(page.getByRole("heading", { name: "Nova Ordem de Serviço" })).not.toBeVisible({
    timeout: 10_000,
  });

  await page.getByPlaceholder("Buscar por número, cliente ou título").fill(titulo);
  const linha = page.getByRole("row", { name: new RegExp(titulo.replace(/[[\]]/g, "\\$&")) });
  await expect(linha).toBeVisible({ timeout: 10_000 });
  await expect(linha.getByText("Aguardando triagem")).toBeVisible();
  await expect(linha.getByRole("button", { name: "Confirmar chamado" })).toBeVisible();
  await expect(linha.getByRole("button", { name: "Planejar" })).toHaveCount(0);

  await linha.getByRole("button", { name: "Confirmar chamado" }).click();
  await expect(linha.getByText("Aguardando triagem")).not.toBeVisible({ timeout: 10_000 });
  await expect(linha.getByText(/^CH-\d+$/)).toBeVisible();
  await expect(linha.getByRole("button", { name: "Planejar" })).toBeVisible();
});
