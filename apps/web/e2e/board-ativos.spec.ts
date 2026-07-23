import { type Locator, expect, test } from "@playwright/test";

// E01-S78 — Board de ativos por Local + drawer de detalhe. Reusa o setup de E01-S76 (cliente >
// Área "Torre A" > Local "3º andar" > sub-local "Sala 302" > item instalado) e valida a aba Board:
// coluna por Local nível-1, subgrupo por sub-local, card do item, e o drawer (breadcrumb + histórico).
// Dev server local + Supabase de PRODUÇÃO (mesmo padrão dos outros specs) — NUNCA URL Netlify.

/** selectOption({label}) exige texto exato; resolve a <option> que contém `textoParcial` (opções de
 * Local/Item vêm de fetch assíncrono — faz polling). Mesmo helper de hierarquia-sistemas.spec.ts. */
async function selecionarPorTexto(select: Locator, textoParcial: string) {
  await expect
    .poll(async () =>
      (await select.locator("option").allTextContents()).some((o) => o.includes(textoParcial)),
    )
    .toBe(true);
  const textos = await select.locator("option").allTextContents();
  const completo = textos.find((t) => t.includes(textoParcial));
  if (!completo) throw new Error(`Opção contendo "${textoParcial}" não encontrada`);
  await select.selectOption({ label: completo });
}

test("Board: colunas por Local, card do ativo e drawer de detalhe", async ({ page }) => {
  const sufixo = Date.now();
  const nomeCliente = `[TESTE E2E] Cliente S78 ${sufixo}`;
  const nomeItem = `[TESTE E2E] AC Board ${sufixo}`;

  // ── Setup: cliente + Área > Local > sub-local + item instalado no sub-local ──────────────────
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).click();
  await page.getByRole("button", { name: "Novo cliente" }).click();
  await page.getByLabel("Nome *").fill(nomeCliente);
  await page.getByRole("button", { name: "Salvar" }).click();
  await page
    .getByPlaceholder("Buscar por cliente, cidade, contato, CNPJ ou ID Auvo")
    .fill(nomeCliente);
  await expect(page.getByText(nomeCliente, { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  });
  await page.getByText(nomeCliente, { exact: true }).first().click();

  await page.getByText("Estrutura", { exact: true }).click();
  await page.getByRole("button", { name: "Nova Área" }).click();
  await page.getByLabel("Nome *").fill("Torre A");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Torre A", { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Local", exact: true }).click();
  await page.getByLabel("Nome *").fill("3º andar");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("3º andar", { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Novo sub-local" }).click();
  await page.getByLabel("Nome *").fill("Sala 302");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Sala 302", { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Equipamentos", { exact: true }).click();
  await page.getByRole("button", { name: "Novo equipamento" }).click();
  await page.getByLabel("Nome *").fill(nomeItem);
  await selecionarPorTexto(page.getByLabel("Cliente"), nomeCliente);
  await selecionarPorTexto(page.getByLabel("Local (AC-4)"), "Sala 302");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(nomeItem, { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  // ── AC-1/AC-2: abre a Visão do Cliente → aba Board ───────────────────────────────────────────
  await page.getByText("Clientes", { exact: true }).click();
  await page
    .getByPlaceholder("Buscar por cliente, cidade, contato, CNPJ ou ID Auvo")
    .fill(nomeCliente);
  await page.getByText(nomeCliente, { exact: true }).first().click();
  await page.getByRole("button", { name: "Board", exact: true }).click();

  // AC-1: seletor de Área. AC-2: coluna do Local nível-1 + subgrupo do sub-local + card do item.
  await expect(page.getByRole("button", { name: "Torre A" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "3º andar" })).toBeVisible();
  await expect(page.getByText("Sala 302", { exact: true })).toBeVisible();
  await expect(page.getByText(nomeItem, { exact: true })).toBeVisible();

  // ── AC-4/AC-5/AC-6: clica no card → drawer com breadcrumb + histórico de OS ──────────────────
  await page.getByText(nomeItem, { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Detalhe do ativo" })).toBeVisible({
    timeout: 10_000,
  });
  const drawer = page.locator(".drawer-panel");
  await expect(drawer.getByText("Instalado em")).toBeVisible();
  await expect(drawer).toContainText("Sala 302"); // breadcrumb resolve o Local de instalação
  await expect(drawer.getByText("Histórico de OS")).toBeVisible();
  // item recém-criado sem OS vinculada — estado vazio honesto, nunca erro.
  await expect(drawer.getByText("Nenhuma OS registrada para este ativo.")).toBeVisible();

  // ── E01-S79: editar o item direto do drawer (antes só era possível visualizar) ─────────────────
  const nomeEditado = `${nomeItem} (editado)`;
  await drawer.getByRole("button", { name: "Editar ativo" }).click();
  const campoNome = page.getByLabel("Nome *");
  await expect(campoNome).toHaveValue(nomeItem);
  await campoNome.fill(nomeEditado);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(drawer.getByText(nomeEditado, { exact: true })).toBeVisible({ timeout: 10_000 });

  // AC-5: fecha por Esc.
  await page.keyboard.press("Escape");
  await expect(page.locator(".drawer-panel")).toHaveCount(0);
  await expect(page.getByText(nomeEditado, { exact: true })).toBeVisible({ timeout: 10_000 });

  // ── E01-S79: drag and drop move o item de "Sala 302" pra "3º andar" (coluna nível-1) ───────────
  const zonaSolteAqui = page.getByText("Solte aqui", { exact: true });
  await expect(zonaSolteAqui).toBeVisible();
  await page.getByText(nomeEditado, { exact: true }).dragTo(zonaSolteAqui);
  await expect(zonaSolteAqui).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText("Sala 302", { exact: true })).toHaveCount(0);
  await expect(page.getByText(nomeEditado, { exact: true })).toBeVisible();
});
