import { expect, test } from "@playwright/test";

// E03-S03. Cobre o que só se prova na tela real: a alíquota vinda do Financeiro (AC-5), o cadastro
// de nível vinculado a um cargo real do PCM (não campo livre — grafia inconsistente em produção),
// e o catálogo de materiais com markup.

test("Tela de Precificação mostra a alíquota vigente vinda do Financeiro", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Comercial", { exact: true }).first().click();
  await page.getByTitle("Precificação", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Precificação" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Alíquota vigente:")).toBeVisible({ timeout: 15_000 });
  // A alíquota some se a RPC falhar — este é o smoke real de que fn_aliquota_efetiva_atual
  // respondeu (guarda de permissão + fórmula), não só que a tela renderizou.
  await expect(page.getByText(/Não foi possível carregar/)).toHaveCount(0);
});

test("Cadastra nível de técnico vinculado a um cargo real do PCM", async ({ page }) => {
  const nome = `[TESTE E2E] Nível ${Date.now()}`;

  await page.goto("/");
  await page.getByText("Comercial", { exact: true }).first().click();
  await page.getByTitle("Precificação", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Precificação" })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByPlaceholder("Ex.: Técnico pleno").fill(nome);
  await page.getByPlaceholder("4.400,00").fill("4400,00");
  await page.getByRole("button", { name: "Adicionar nível" }).click();

  await expect(page.getByText(nome)).toBeVisible({ timeout: 15_000 });

  // Sem cargo vinculado ainda: o combobox mostra "sem cargo" selecionado (AC-4, custo estimado)
  // — <option> não conta como "visible" pro Playwright, então o teste é sobre o valor selecionado.
  const linhaDoNivel = page.locator("li", { hasText: nome });
  await expect(linhaDoNivel.getByRole("combobox")).toHaveValue("");

  // AC-4 real: a grafia real do cargo em produção é inconsistente ("Of. de Manutenção" ×
  // "Oficial de Manutenção") — confirma que a UI oferece os cargos como lista, não campo livre.
  await expect(linhaDoNivel.getByRole("option", { name: "Of. de Manutenção" })).toHaveCount(1);
  await expect(linhaDoNivel.getByRole("option", { name: "Oficial de Manutenção" })).toHaveCount(1);
});

test("Cadastra material com markup e ele aparece no catálogo", async ({ page }) => {
  const nome = `[TESTE E2E] Material ${Date.now()}`;

  await page.goto("/");
  await page.getByText("Comercial", { exact: true }).first().click();
  await page.getByTitle("Precificação", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Precificação" })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByPlaceholder("Ex.: Compressor 1/3 HP").fill(nome);
  await page.getByPlaceholder("un").fill("un");
  await page.getByPlaceholder("120,00").fill("150,00");
  await page.getByRole("button", { name: "Adicionar material" }).click();

  await expect(page.getByText(nome)).toBeVisible({ timeout: 15_000 });
});
