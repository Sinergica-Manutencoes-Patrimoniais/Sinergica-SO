import { expect, test } from "@playwright/test";

// E01-S69: OS clicável e editável. Cria uma OS de teste (prefixo [TESTE E2E], limpa via
// scripts/e2e-cleanup.mjs depois), edita o título e confirma que a mudança persiste.
test("cria OS, abre detalhe e edita", async ({ page }) => {
  const titulo = `[TESTE E2E] OS ${Date.now()}`;
  const tituloEditado = `${titulo} (editado)`;

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Ordens de Serviço", { exact: true }).click();

  await page.getByRole("button", { name: "Nova OS" }).click();
  await page.getByPlaceholder("Ex: Reparo vazamento tubulação — Térreo").fill(titulo);
  await page
    .getByPlaceholder("Descreva o problema, evidências, restrições de acesso e contexto relevante.")
    .fill("Criada por teste automatizado (Playwright, E01-S69).");
  await page.getByRole("button", { name: "Criar OS" }).click();

  await expect(page.getByRole("button", { name: "Nova OS" })).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder("Buscar por número, cliente ou título").fill(titulo);
  await expect(page.getByText(titulo, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.getByText(titulo, { exact: true }).first().click();

  await expect(page.getByRole("heading", { name: titulo })).toBeVisible();

  await page.getByRole("button", { name: "Editar" }).click();
  const campoTitulo = page.getByPlaceholder("Ex: Reparo vazamento tubulação — Térreo");
  await expect(campoTitulo).toHaveValue(titulo);
  await campoTitulo.fill(tituloEditado);
  await page.getByRole("button", { name: "Salvar alterações" }).click();

  await expect(page.getByRole("heading", { name: tituloEditado })).toBeVisible({ timeout: 10_000 });
});

// E01-S81 AC-4: sem a IA configurada em produção (estado real — não ativei a integração), o botão
// "Gerar título" degrada visivelmente desabilitado, nunca finge que vai gerar algo.
test("botão Gerar título fica desabilitado sem IA configurada", async ({ page }) => {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Ordens de Serviço", { exact: true }).click();

  await page.getByRole("button", { name: "Nova OS" }).click();
  await expect(page.getByRole("button", { name: "Gerar título" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Gerar título" })).toBeDisabled();
});

// E01-S81 AC-1: Configurações > IA carrega pro superadmin, mostra o estado real (chave ainda não
// configurada) — não altera nada (evita ligar a integração em produção sem chave real).
test("Configurações > IA mostra o estado da credencial OpenRouter", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.getByRole("navigation").getByText("IA", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "OpenRouter" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Chave não configurada", { exact: true })).toBeVisible();
});

// E01-S82 AC-2/AC-4: o form de OS ganhou o campo "Dor do cliente" (D do GUTD) — opcional, com
// "Não avaliado" como default (retrocompat) — e o painel de score virou "GUTD" (não mais "GUT").
test("Nova OS mostra o campo GUTD com Dor do cliente opcional", async ({ page }) => {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Ordens de Serviço", { exact: true }).click();

  await page.getByRole("button", { name: "Nova OS" }).click();
  await expect(page.getByText("GUTD", { exact: true })).toBeVisible({ timeout: 15_000 });

  const dorCliente = page.getByLabel("Dor do cliente");
  await expect(dorCliente).toBeVisible();
  await expect(dorCliente).toHaveValue("");
  await expect(dorCliente.getByRole("option", { name: "Não avaliado" })).toBeAttached();
});

// E01-S82 AC-2: Configurações > Priorização carrega os pesos GUTD vigentes (semeados 25/25/25/25,
// somando 100%) pro superadmin — só confere leitura, não salva nada (evita alterar em produção a
// ordenação real do backlog).
test("Configurações > Priorização mostra os pesos GUTD vigentes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.getByRole("navigation").getByText("Priorização", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Priorização (GUTD)" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/Soma atual: \d+%/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar pesos" })).toBeVisible();
});
