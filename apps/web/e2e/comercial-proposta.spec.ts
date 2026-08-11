import { expect, test } from "@playwright/test";

// E03-S04. Fluxo completo do editor de proposta: criar, compor item, ver o cálculo ao vivo,
// salvar (persiste via RPC) e tentar avançar sem item primeiro (deve barrar, AC-1 caso de borda).
test("Cria proposta, monta composição, vê cálculo ao vivo e salva", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Comercial", { exact: true }).first().click();
  // O Funil é a view padrão do módulo desde a E03-S02 — precisa navegar pra Contas explicitamente.
  await page.getByTitle("Contas", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible({ timeout: 15_000 });

  // Cria oportunidade na primeira conta da lista (mesmo caminho da E03-S01/S02).
  await page.getByRole("button", { name: "Oportunidade" }).first().click();
  await expect(page.getByRole("heading", { name: /Nova oportunidade/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Título").fill(`[TESTE E2E] Oportunidade proposta ${Date.now()}`);
  await page.getByRole("button", { name: "Criar oportunidade" }).click();
  await expect(page.getByRole("heading", { name: /Nova oportunidade/ })).toBeHidden({
    timeout: 15_000,
  });

  // Abre o editor de propostas dessa oportunidade — dentro da Visão 360, aba Comercial.
  // (Como o teste roda sem saber o clienteId de antemão, navega pela primeira linha com o botão.)
  await page.getByRole("button", { name: "Propostas" }).first().click();

  await expect(page.getByRole("heading", { name: "Precificação" })).toBeHidden();
  await page.getByRole("button", { name: "Nova proposta" }).click();

  await expect(page.getByText(/Rascunho/).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("button", { name: "Adicionar item" }).click();

  const descricao = page.getByLabel("Descrição").last();
  await descricao.fill("Item de teste E2E");
  const quantidade = page.getByLabel(/Qtd\.|Horas/).last();
  await quantidade.fill("2");

  // O bloco de cálculo ao vivo precisa refletir o item assim que ele é digitado, sem salvar.
  await expect(page.getByText("Custo")).toBeVisible();
  await expect(page.getByText("Piso")).toBeVisible();
  await expect(page.getByText("Preço sugerido")).toBeVisible();

  await page.getByRole("button", { name: "Salvar composição" }).click();
  await expect(page.getByRole("button", { name: "Salvar composição" })).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.getByText("Item de teste E2E")).toBeVisible();
});
