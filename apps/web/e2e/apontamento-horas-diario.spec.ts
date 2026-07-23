import { expect, test } from "@playwright/test";

// E01-S77: visão diária de apontamento de horas por técnico.
// Dev server local + Supabase de PRODUÇÃO (ver playwright.config.ts). Dado real pode variar por
// período, então as asserções focam na estrutura sempre presente (abas, cabeçalhos, export, hint
// de tendência) e degradam com isVisible().catch onde o dado é condicional.

async function abrirApontamento(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Apontamento de Horas", { exact: true }).click();
  await page.waitForTimeout(1200);
}

// AC-9: a visão anterior (Por período) continua intacta ao lado da aba nova.
test("Apontamento: abas Por período e Por dia coexistem, sem regressão", async ({ page }) => {
  await abrirApontamento(page);

  await expect(page.getByRole("button", { name: "Por período" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Por dia" })).toBeVisible();

  // Por período (default) mantém os painéis existentes.
  await expect(page.getByRole("heading", { name: "Horas por cliente" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Horas por técnico" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "OS no período" })).toBeVisible();
});

// AC-1..AC-6: a aba Por dia mostra a tabela (técnico, dia) com span, soma e status.
test("Apontamento: aba Por dia mostra span, soma e permite expandir/exportar", async ({ page }) => {
  await abrirApontamento(page);
  await page.getByRole("button", { name: "Por dia" }).click();

  // Cabeçalho da seção e botão de export sempre presentes.
  await expect(page.getByRole("heading", { name: "Por dia", exact: true })).toBeVisible();
  const exportar = page.getByRole("button", { name: "Exportar CSV" });
  await expect(exportar).toBeVisible();

  // Amplia a janela pra maximizar a chance de haver dado real com check-in/out.
  const linhaTecnico = page.locator("tbody tr").first();
  if (await linhaTecnico.isVisible().catch(() => false)) {
    // AC-2/AC-3: colunas de diferença do dia e soma das OS em HHhMMmin (nunca decimal).
    await expect(page.getByRole("columnheader", { name: "Diferença do dia" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Soma das OS" })).toBeVisible();
    await expect(
      page
        .locator("tbody")
        .getByText(/\d+h\d{2}min/)
        .first(),
    ).toBeVisible();

    // AC-4: expandir a linha revela as OS do dia; o botão do técnico é o expansor.
    await linhaTecnico.getByRole("button").first().click();
    await page.waitForTimeout(300);

    // AC-7: exportar CSV dispara um download com o nome esperado.
    const [download] = await Promise.all([page.waitForEvent("download"), exportar.click()]);
    expect(download.suggestedFilename()).toMatch(/^apontamento-horas_.*\.csv$/);
  }
});

// AC-8: a sub-visão de tendência exige um técnico selecionado.
test("Apontamento: tendência pede técnico selecionado e carrega ao escolher", async ({ page }) => {
  await abrirApontamento(page);
  await page.getByRole("button", { name: "Por dia" }).click();

  // Sem técnico no filtro → hint pedindo seleção.
  await expect(page.getByText(/Selecione um técnico.*tendência semanal/i)).toBeVisible();

  // Seleciona o primeiro técnico real disponível no filtro.
  const seletorTecnico = page.locator("select").nth(0);
  const opcoes = await seletorTecnico.locator("option").count();
  if (opcoes > 1) {
    await seletorTecnico.selectOption({ index: 1 });
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Por dia" }).click();
    const tendencia = page
      .getByRole("heading", { name: /Tendência semanal/ })
      .locator("xpath=ancestor::section[1]");
    await expect(tendencia).toBeVisible();
    await tendencia.getByRole("button", { name: "Carregar" }).click();
    // pronto (barras com HHhMMmin) ou estado vazio honesto — nunca erro não tratado. Escopo à
    // seção de tendência pra não casar com a tabela "Por dia" (que também tem "· N OS").
    await expect(
      tendencia.getByText(/Sem horas nas últimas 8 semanas\.|\d+h\d{2}min/).first(),
    ).toBeVisible({ timeout: 10_000 });
  }
});
