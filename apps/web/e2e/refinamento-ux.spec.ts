import { expect, test } from "@playwright/test";

// E01-S75 AC-2/AC-3: detalhe da OS expande num modal grande com as abas ricas do Auvo.
test("OS: expandir abre modal grande, fecha por X e por Esc", async ({ page }) => {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Ordens de Serviço", { exact: true }).click();
  await page.waitForTimeout(800);

  await page.getByRole("button", { name: "Expandir detalhe da OS" }).click();
  await expect(page.locator(".modal-panel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fechar" })).toBeVisible();

  // fecha por Esc
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal-panel")).toHaveCount(0);

  // reabre e fecha pelo X
  await page.getByRole("button", { name: "Expandir detalhe da OS" }).click();
  await expect(page.locator(".modal-panel")).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page.locator(".modal-panel")).toHaveCount(0);
});

// E01-S75 AC-1: histórico de posse por unidade, acessível pela lista densa de Ferramentas.
test("Ferramentas: histórico de unidade abre e mostra o rótulo da unidade", async ({ page }) => {
  const nome = `[TESTE E2E] Ferramenta Historico ${Date.now()}`;

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Ferramentas", { exact: true }).click();

  await page.getByRole("button", { name: "Nova ferramenta" }).click();
  await page.getByLabel("Nome *").fill(nome);
  await page.getByLabel("Quantidade total").fill("1");
  await page.getByRole("button", { name: "Salvar" }).click();

  const linha = page
    .getByText(nome, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"py-2.5")][1]');
  await expect(linha).toBeVisible({ timeout: 10_000 });
  await linha.getByText(nome, { exact: true }).click();
  await linha.getByRole("button", { name: /Gerar/ }).click();
  await expect(linha.getByText(/FER-\d{4}/)).toBeVisible({ timeout: 10_000 });

  await linha.getByRole("button", { name: "Histórico" }).click();
  await expect(page.getByText(/Histórico de FER-\d{4}/)).toBeVisible({ timeout: 10_000 });
  // unidade recém-gerada nunca foi movimentada — estado vazio honesto, não erro.
  await expect(page.getByText("Sem movimentações registradas.")).toBeVisible();
  await page.getByRole("button", { name: "fechar" }).click();
});

// E01-S75 AC-5: linha de "Horas por cliente"/"por técnico" navega com o período preservado.
test("Apontamento de Horas: clique em cliente e em técnico navega", async ({ page }) => {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Apontamento de Horas", { exact: true }).click();
  await page.waitForTimeout(1200);

  const painelCliente = page
    .getByRole("heading", { name: "Horas por cliente" })
    .locator("xpath=ancestor::section[1]");
  const linhaCliente = painelCliente.getByRole("button").first();
  if (await linhaCliente.isVisible().catch(() => false)) {
    await linhaCliente.click();
    await expect(page.getByRole("button", { name: "Voltar para clientes" })).toBeVisible({
      timeout: 10_000,
    });
    // volta pra Horas pra testar o clique em técnico também
    await page.getByText("PCM · Operação", { exact: true }).first().click();
    await page.getByText("Apontamento de Horas", { exact: true }).click();
    await page.waitForTimeout(1200);
  }

  const painelTecnico = page
    .getByRole("heading", { name: "Horas por técnico" })
    .locator("xpath=ancestor::section[1]");
  const linhaTecnico = painelTecnico.getByRole("button").first();
  if (await linhaTecnico.isVisible().catch(() => false)) {
    await linhaTecnico.click();
    await expect(page.getByRole("button", { name: "Nova OS" })).toBeVisible({ timeout: 10_000 });
  }
});

// E01-S75: Clientes vira tabela densa (mais dados visíveis na mesma tela).
test("Clientes: lista em tabela com colunas de OS/ativos/GUT", async ({ page }) => {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).click();
  await page.waitForTimeout(1000);

  await expect(page.getByRole("columnheader", { name: "Cliente" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "OS abertas" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Ativos" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Maior GUT" })).toBeVisible();
});
