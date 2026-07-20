import { type Locator, expect, test } from "@playwright/test";

/** selectOption({label}) só aceita string exata, não RegExp/substring — resolve o texto completo
 * da <option> que contém `textoParcial` (ex.: nome com sufixo Auvo) e seleciona por ele. Faz
 * polling: opções de Local/Item vêm de fetch assíncrono disparado por outra escolha do form. */
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

// E01-S76 — AC-1..AC-8: cria Área "Torre A" > Local "3º andar" > sub-local "Sala 302", atribui um
// equipamento ao sub-local, cria "Sistema de Hidrante Torre A" com esse item, abre o Item e
// confirma breadcrumb Cliente>Área>Local + chip do sistema. Confirma também que criar o Sistema
// enfileira no outbox mas não grava no Auvo real (writeEnabled:false, dry-run) — sem chamada de
// rede ao Auvo observável pela UI, só o status "Pendente (dry-run)".
//
// Dev server local (pnpm dev), Supabase de PRODUÇÃO (mesmo padrão de ferramentas.spec.ts/
// ordens-servico.spec.ts) — NUNCA contra a URL Netlify de produção. Cliente prefixado com
// timestamp garante que "Torre A"/"3º andar"/"Sala 302"/"Sistema de Hidrante Torre A" (nomes do
// AC) não colidem com execuções anteriores (unique index é por cliente).
test("cria hierarquia Área>Local, instala Item, cria Sistema e confirma breadcrumb + chip", async ({
  page,
}) => {
  const sufixo = Date.now();
  const nomeCliente = `[TESTE E2E] Cliente S76 ${sufixo}`;
  const nomeItem = `[TESTE E2E] Hidrante ${sufixo}`;
  // SistemasPage lista Sistemas de TODOS os clientes (sem filtro) — sufixo evita colidir com
  // "Sistema de Hidrante Torre A" de execuções anteriores do mesmo spec.
  const nomeSistema = `Sistema de Hidrante Torre A ${sufixo}`;

  // ── Cliente de teste ──────────────────────────────────────────────────
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

  // ── AC-1/AC-2: Estrutura — Área "Torre A" > Local "3º andar" > sub-local "Sala 302" ────────
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

  // ── AC-4: cria Item (equipamento) e instala em "Sala 302" ──────────────────────────────────
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Equipamentos", { exact: true }).click();
  await page.getByRole("button", { name: "Novo equipamento" }).click();
  await page.getByLabel("Nome *").fill(nomeItem);
  await selecionarPorTexto(page.getByLabel("Cliente"), nomeCliente);
  // Local depende de fetch assíncrono (listarLocaisDoCliente) disparado pela troca de cliente —
  // selecionarPorTexto já faz o polling da opção aparecer.
  await selecionarPorTexto(page.getByLabel("Local (AC-4)"), "Sala 302");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(nomeItem, { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  // ── AC-7/AC-8: cria Sistema, adiciona o Item, confirma status dry-run ───────────────────────
  await page.getByText("Sistemas", { exact: true }).click();
  await page.getByRole("button", { name: "Novo Sistema" }).click();
  await selecionarPorTexto(page.getByLabel("Cliente *"), nomeCliente);
  await page.getByPlaceholder('ex.: "Sistema de Hidrante Torre A"').fill(nomeSistema);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(nomeSistema, { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  // AC-8: writeEnabled:false — o Sistema fica visivelmente pendente de sync, nunca "Sincronizado".
  await expect(page.getByText("Pendente (dry-run)").first()).toBeVisible();

  const linhaSistema = page
    .getByText(nomeSistema, { exact: true })
    .locator("xpath=ancestor::section[1]");
  await linhaSistema.getByRole("button", { name: "Itens" }).click();
  // Itens disponíveis vêm de fetch assíncrono (listarItensDisponiveis) — selecionarPorTexto faz o polling.
  await selecionarPorTexto(linhaSistema.locator("select"), nomeItem);
  await linhaSistema.getByRole("button", { name: "Adicionar" }).click();
  await expect(linhaSistema.getByText(nomeItem, { exact: true })).toBeVisible({ timeout: 10_000 });

  // ── AC-6: abre o Item e confirma breadcrumb Cliente>Área>Local + chip do Sistema ───────────
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Equipamentos", { exact: true }).click();
  const linhaItem = page
    .getByText(nomeItem, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"py-2.5")][1]');
  await linhaItem.getByRole("button", { name: "Detalhe" }).click();

  const breadcrumb = page.getByTestId("item-breadcrumb");
  await expect(breadcrumb).toContainText(nomeCliente, { timeout: 10_000 });
  await expect(breadcrumb).toContainText("Torre A");
  await expect(breadcrumb).toContainText("Sala 302");
  await expect(page.getByText(nomeSistema, { exact: false })).toBeVisible();

  // ── Ativos (Visão 360): confirma que "Itens PCM" mostra o Item com o Local já atribuído,
  // e que dá pra atribuir/trocar o Local direto dali (feedback do Lucas: editar sem sair do
  // cliente, sem precisar achar o item na lista global de Equipamentos).
  await page.getByRole("button", { name: "Fechar" }).click(); // fecha o modal de Detalhe
  await page.getByText("Clientes", { exact: true }).click();
  await page
    .getByPlaceholder("Buscar por cliente, cidade, contato, CNPJ ou ID Auvo")
    .fill(nomeCliente);
  await page.getByText(nomeCliente, { exact: true }).first().click();
  await page.getByRole("button", { name: "Ativos", exact: true }).click();
  await expect(page.getByText("Itens PCM (estrutura)", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  const seletorLocalAtivos = page.getByLabel(`Local de ${nomeItem}`);
  await expect(seletorLocalAtivos).toBeVisible({ timeout: 10_000 });
  await expect(seletorLocalAtivos).toHaveValue(/.+/); // já vem preenchido (atribuído via AC-4)
});
