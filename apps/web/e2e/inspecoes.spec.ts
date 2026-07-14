import { type Page, expect, test } from "@playwright/test";

function fieldSelect(page: Page, label: string) {
  return page
    .locator("div.block", { has: page.locator("span", { hasText: label }) })
    .locator("select");
}

function fieldInput(page: Page, label: string) {
  return page
    .locator("div.block", { has: page.locator("span", { hasText: label }) })
    .locator("input");
}

// E01-S73: reconstrução ABNT NBR 16747 — cabeçalho rico, tipo/checklist pré-carregando itens,
// edição de cabeçalho e item (grau de risco, resultado "não aplicável"), exclusão de item (AC-1,
// gap de RLS corrigido nesta story — antes não existia policy de DELETE em inspecao_itens).
test("cria tipo+checklist, cria inspeção com template pré-carregado, edita cabeçalho e item, exclui item", async ({
  page,
}) => {
  const ts = Date.now();
  const nomeTipo = `[TESTE E2E] Predial ${ts}`;
  const nomeTemplate = `[TESTE E2E] Checklist ${ts}`;
  const tituloInspecao = `[TESTE E2E] Inspeção ${ts}`;

  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();

  // 1. Tipo + checklist (parametrização, AC-4)
  await page.getByText("Tipos de Inspeção", { exact: true }).click();
  await page.getByRole("button", { name: "Novo tipo" }).click();
  await page.getByLabel("Nome *").fill(nomeTipo);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(nomeTipo, { exact: true })).toBeVisible({ timeout: 10_000 });

  const cardDoTipo = page
    .locator("h4", { hasText: nomeTipo })
    .locator('xpath=ancestor::div[contains(@class,"rounded-[8px]")][1]');
  await cardDoTipo.getByRole("button", { name: "+ Novo checklist" }).click();
  await page.getByLabel("Nome do checklist *").fill(nomeTemplate);
  await page.getByPlaceholder("Categoria").fill("Estrutural");
  await page.getByPlaceholder("Elemento").fill("Viga de sustentação");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(`${nomeTemplate} · 1 item(ns)`)).toBeVisible({ timeout: 10_000 });

  // 2. Nova inspeção usando o tipo — checklist deve pré-carregar o item (AC-4)
  await page.getByText("Inspeções", { exact: true }).click();
  await page.getByRole("button", { name: "Nova" }).click();
  await fieldSelect(page, "Tipo de inspeção").selectOption({ label: nomeTipo });
  await page
    .getByPlaceholder("Ex: Inspeção Predial — Condomínio — julho/2026")
    .fill(tituloInspecao);
  await fieldSelect(page, "Checklist (pré-carrega os itens)").selectOption({
    label: `${nomeTemplate} (1 itens)`,
  });
  await page.getByRole("button", { name: "Criar inspeção" }).click();

  await expect(page.getByText(tituloInspecao, { exact: false }).first()).toBeVisible({
    timeout: 10_000,
  });
  // item do template já veio pré-carregado (descrição = "Estrutural — Viga de sustentação")
  await expect(page.getByText("Viga de sustentação", { exact: false }).first()).toBeVisible({
    timeout: 10_000,
  });

  // 3. Editar cabeçalho (AC-1) — confirma persistência reabrindo o formulário (o valor não é
  // exibido em lugar nenhum da view de leitura, só no form; AC-2 exige exposição no formulário).
  await page.getByRole("button", { name: "Editar" }).click();
  await fieldInput(page, "Edificação / local").fill("Bloco A — Térreo");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("button", { name: "Salvar alterações" })).not.toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "Editar" }).click();
  await expect(fieldInput(page, "Edificação / local")).toHaveValue("Bloco A — Térreo", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Cancelar" }).click();

  // 4. Editar item: grau de risco + resultado "não aplicável"
  const itemCard = page.locator("article", { hasText: "Viga de sustentação" });
  await itemCard.getByRole("button", { name: "Expandir detalhes" }).click();
  await itemCard.getByRole("button", { name: "Editar" }).click();
  await fieldSelect(page, "Resultado *").selectOption({ label: "Não aplicável" });
  await fieldSelect(page, "Grau de risco").selectOption({ label: "Baixo" });
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(itemCard.getByText("Não aplicável", { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  // 5. Excluir item (AC-1 — gap de RLS corrigido nesta story: antes não existia policy DELETE)
  await itemCard.getByRole("button", { name: "Expandir detalhes" }).click();
  await itemCard.getByRole("button", { name: "Excluir" }).click();
  await expect(page.locator("article", { hasText: "Viga de sustentação" })).toHaveCount(0, {
    timeout: 10_000,
  });
});
