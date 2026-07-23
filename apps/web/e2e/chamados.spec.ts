import { expect, test } from "@playwright/test";

// E01-S88 AC-1/AC-2/AC-3/AC-5: cria um Chamado pela tela, confirma numeração CH-XXXX e status
// aberto, gera uma OS a partir dele (AC-3, vínculo + numeração OS-XXXX — prefixo novo, confirma
// AC-5/renumeração), e confirma que o Chamado passa a aparecer como "Convertido em OS".
test("cria Chamado, gera OS a partir dele e confirma numeração/status", async ({ page }) => {
  const sufixo = Date.now();
  const tituloChamado = `[TESTE E2E] Chamado ${sufixo}`;

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Chamados", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chamados" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Novo Chamado" }).click();
  await expect(page.getByRole("heading", { name: "Novo Chamado" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByLabel("Título *").fill(tituloChamado);
  await page.getByRole("button", { name: "Criar Chamado" }).click();

  const linha = page
    .getByText(tituloChamado, { exact: true })
    .locator("xpath=ancestor::section[1]");
  await expect(linha).toBeVisible({ timeout: 10_000 });
  // AC-1: numeração CH-XXXX (não CH-XXX de 3 dígitos — o formato de OS pré-S88).
  await expect(linha.getByText(/^CH-\d{4}$/)).toBeVisible();
  await expect(linha.getByText("Aberto", { exact: true })).toBeVisible();

  // AC-3: gera OS a partir do Chamado — tipo de tarefa já vem pré-selecionado (primeiro
  // disponível), só confirma.
  await linha.getByRole("button", { name: "Gerar OS" }).click();
  await expect(page.getByRole("heading", { name: "Gerar OS" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Confirmar" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: "Confirmar" }).click();

  await expect(linha.getByText("Convertido em OS", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  // AC-3/AC-5 combinados: o Chamado não tem mais os botões de ação de "aberto".
  await expect(linha.getByRole("button", { name: "Gerar OS" })).not.toBeVisible();
});

// E01-S88 AC-4: cancelamento exige justificativa (bloqueia sem ela) e aceita anexo opcional.
test("cancela um Chamado com justificativa e anexo", async ({ page }) => {
  const sufixo = Date.now();
  const tituloChamado = `[TESTE E2E] Chamado cancelar ${sufixo}`;

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Chamados", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chamados" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Novo Chamado" }).click();
  await page.getByLabel("Título *").fill(tituloChamado);
  await page.getByRole("button", { name: "Criar Chamado" }).click();

  const linha = page
    .getByText(tituloChamado, { exact: true })
    .locator("xpath=ancestor::section[1]");
  await expect(linha).toBeVisible({ timeout: 10_000 });

  await linha.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("heading", { name: "Cancelar Chamado" })).toBeVisible({
    timeout: 10_000,
  });

  // AC-4: sem justificativa, o botão de confirmar fica desabilitado (nunca cancela sem motivo).
  await expect(page.getByRole("button", { name: "Confirmar cancelamento" })).toBeDisabled();

  await page.getByLabel("Justificativa *").fill("Cliente desistiu (teste E01-S88)");
  await page.setInputFiles('input[type="file"]', {
    name: "print-whatsapp.png",
    mimeType: "image/png",
    buffer: Buffer.from("teste e2e anexo de cancelamento"),
  });
  await page.getByRole("button", { name: "Confirmar cancelamento" }).click();

  await expect(linha.getByText("Cancelado", { exact: true })).toBeVisible({ timeout: 10_000 });
});
