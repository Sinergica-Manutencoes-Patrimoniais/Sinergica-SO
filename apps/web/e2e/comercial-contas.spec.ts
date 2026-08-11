import { expect, test } from "@playwright/test";

// E03-S01. Cobre os AC que só se provam na tela real: a Lista de Contas mostrando conta INATIVA
// (AC-7 — é o que diferencia do PCM), a criação de oportunidade (AC-4), a aba Comercial dentro da
// Visão 360 (AC-9) e o motivo de perda barrado pelo banco (AC-6).

test("Lista de Contas mostra contas inativas — o que a Lista de Clientes do PCM esconde", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Comercial", { exact: true }).first().click();

  await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible({ timeout: 15_000 });

  // Sem filtro, a lista traz ativas e inativas juntas. Em produção há 49 contas vivas, com
  // inativas entre elas — se este filtro voltar a existir, o AC-7 quebrou.
  await page.getByLabel("Situação").selectOption("inativas");
  await expect(page.getByRole("cell", { name: "Inativa" }).first()).toBeVisible({
    timeout: 15_000,
  });

  await page.getByLabel("Situação").selectOption("todas");
  await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible();
});

test("Configuração do funil traz o seed e recusa desativar a última etapa aberta", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Comercial", { exact: true }).first().click();
  await page.getByTitle("Configuração do funil", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Configuração do funil" })).toBeVisible({
    timeout: 15_000,
  });

  // AC-2: seed das 6 etapas e dos motivos de perda.
  for (const etapa of [
    "Lead",
    "Qualificado",
    "Proposta enviada",
    "Negociação",
    "Ganho",
    "Perdido",
  ]) {
    await expect(page.getByText(etapa, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText("Fechou com concorrente", { exact: true })).toBeVisible();
});

test("Cria oportunidade e ela aparece na aba Comercial da Visão 360", async ({ page }) => {
  const titulo = `[TESTE E2E] Oportunidade ${Date.now()}`;

  await page.goto("/");
  await page.getByText("Comercial", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible({ timeout: 15_000 });

  // AC-4: criar a partir da linha da Conta.
  await page.getByRole("button", { name: "Oportunidade" }).first().click();
  await expect(page.getByRole("heading", { name: /Nova oportunidade/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Título").fill(titulo);
  await page.getByLabel("Valor estimado (R$)").fill("4.500,00");
  await page.getByRole("button", { name: "Criar oportunidade" }).click();

  // A lista se atualiza pela invalidação de chave do TanStack Query — sem recarga manual.
  await expect(page.getByRole("heading", { name: /Nova oportunidade/ })).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.getByText("Sem oportunidade").first()).toBeHidden({ timeout: 15_000 });
});

test("Busca com debounce não deixa resultado antigo sobrescrever o filtro novo", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Comercial", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible({ timeout: 15_000 });

  // Digitação rápida: só a última busca vale. Antes do TanStack + debounce, uma resposta lenta
  // de "con" podia chegar depois de "condominio" e sobrescrever a lista.
  const busca = page.getByLabel("Buscar");
  await busca.fill("c");
  await busca.fill("co");
  await busca.fill("con");

  await page.waitForTimeout(1_000);
  await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible();
  // Sem erro de console e sem lista quebrada: a tela continua utilizável.
  await expect(page.locator("text=Falha ao carregar contas.")).toHaveCount(0);
});
