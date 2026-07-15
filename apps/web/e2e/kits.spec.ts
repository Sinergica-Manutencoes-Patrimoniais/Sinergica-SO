import { expect, test } from "@playwright/test";

// E01-S66: atribuição/devolução de kit tudo-ou-nada. Kit e ferramenta são de teste
// ([TESTE E2E], desativados no fim); o técnico usado na atribuição é um funcionário real já
// cadastrado — atribuir/devolver kit é conceito só do PCM (não sincroniza com Auvo), então não há
// efeito nenhum na conta Auvo do técnico, só uma linha transitória em pcm.ferramenta_movimentacoes.
//
// Achado ao escrever este teste: a lista "Kits" mostra SEMPRE todos os kits (o badge
// completo/incompleto só reflete estoque disponível agora) — um kit atribuído continua
// aparecendo ali como "Incompleto" (a unidade está com o técnico) AO MESMO TEMPO que ganha um
// card em "Kits atribuídos" (que só mostra "{técnico} · N/M unidade(s)", sem nome do kit). Não dá
// pra escopar "Devolver kit" pelo nome do kit — o teste usa contagem de botões antes/depois.
test("cria ferramenta+unidade, cria kit, atribui e devolve (tudo-ou-nada)", async ({ page }) => {
  const ts = Date.now();
  const nomeFerramenta = `[TESTE E2E] Ferramenta Kit ${ts}`;
  const nomeKit = `[TESTE E2E] Kit ${ts}`;

  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Ferramentas", { exact: true }).click();

  // 1. Ferramenta de teste com 1 unidade disponível
  await page.getByRole("button", { name: "Nova ferramenta" }).click();
  await page.getByLabel("Nome *").fill(nomeFerramenta);
  await page.getByLabel("Quantidade total").fill("1");
  await page.getByRole("button", { name: "Salvar" }).click();

  // E01-S75: Ferramentas virou lista densa — a linha é o ancestral `div.py-2.5` mais próximo do
  // nome (só a linha tem essa classe).
  const linhaFerramenta = page
    .getByText(nomeFerramenta, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"py-2.5")][1]');
  await expect(linhaFerramenta).toBeVisible({ timeout: 10_000 });
  await linhaFerramenta.getByText(nomeFerramenta, { exact: true }).click();
  await linhaFerramenta.getByRole("button", { name: /Gerar/ }).click();
  await expect(linhaFerramenta.getByText(/FER-\d{4}/)).toBeVisible({ timeout: 10_000 });

  // KitsSection carrega disponibilidade só 1x (mount) — recarrega pra pegar estado fresco.
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Ferramentas", { exact: true }).click();
  await page.waitForLoadState("networkidle");

  // 2. Kit com essa ferramenta
  await page.getByRole("button", { name: "Novo kit" }).click();
  await page.getByLabel("Nome *").fill(nomeKit);
  await page.locator(".modal-backdrop select").first().selectOption({ label: nomeFerramenta });
  await page.getByRole("button", { name: "Salvar" }).click();

  const cardKit = page.locator("li", { hasText: nomeKit });
  await expect(cardKit).toBeVisible({ timeout: 10_000 });
  await expect(cardKit.getByText("Completo agora")).toBeVisible({ timeout: 10_000 });

  // 3. Atribui a um técnico real (kit é conceito só do PCM, não toca Auvo)
  const devolucoesAntes = await page.getByRole("button", { name: "Devolver kit" }).count();
  await cardKit.getByRole("button", { name: "Atribuir" }).click();
  await page.locator(".modal-backdrop select").selectOption({ index: 1 });
  await page.locator(".modal-backdrop").getByRole("button", { name: "Atribuir" }).click();
  await expect(page.locator(".modal-backdrop")).toHaveCount(0, { timeout: 10_000 });

  const botoesDevolver = page.getByRole("button", { name: "Devolver kit" });
  await expect(botoesDevolver).toHaveCount(devolucoesAntes + 1, { timeout: 10_000 });
  // atribuído consome a única unidade — kit continua listado, agora "Incompleto"
  await expect(cardKit.getByText("Incompleto")).toBeVisible({ timeout: 10_000 });

  // 4. Devolve — tudo-ou-nada, unidade volta a disponível
  await botoesDevolver.last().click();
  await expect(botoesDevolver).toHaveCount(devolucoesAntes, { timeout: 10_000 });
  await expect(cardKit).toBeVisible({ timeout: 10_000 });
  await expect(cardKit.getByText("Completo agora")).toBeVisible({ timeout: 10_000 });
});
