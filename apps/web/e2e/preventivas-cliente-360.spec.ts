import { expect, test } from "@playwright/test";

const clienteA = process.env.E2E_PREVENTIVAS_CLIENTE_A;
const clienteB = process.env.E2E_PREVENTIVAS_CLIENTE_B;
const nomeClienteA = process.env.E2E_PREVENTIVAS_NOME_A;
const nomeClienteB = process.env.E2E_PREVENTIVAS_NOME_B;
const osNumeroConcluida = process.env.E2E_PREVENTIVAS_OS_NUMERO_CONCLUIDA;
const auvoUrlConcluida = process.env.E2E_PREVENTIVAS_AUVO_URL_CONCLUIDA;

test("Preventivas no 360 isola cliente em consultas e formulário (E01-S53 AC-8)", async ({
  page,
}) => {
  test.skip(
    !clienteA || !clienteB || !nomeClienteA || !nomeClienteB,
    "Requer sessão autenticada e dois clientes de teste existentes; não cria task Auvo.",
  );
  const planosVistos: string[] = [];
  const ocorrenciasVistas: string[] = [];
  const avaliacoesVistas: string[] = [];
  await page.route("**/rest/v1/planos_preventivos*", async (route) => {
    const url = route.request().url();
    planosVistos.push(url);
    expect(url).toMatch(/cliente_id=eq\.[^&]+/);
    await route.continue();
  });
  await page.route("**/rest/v1/ocorrencias_preventivas*", async (route) => {
    ocorrenciasVistas.push(route.request().url());
    expect(decodeURIComponent(route.request().url())).toContain("plano_id=in.(");
    await route.continue();
  });
  await page.route("**/rest/v1/avaliacoes_preventivas*", async (route) => {
    avaliacoesVistas.push(route.request().url());
    expect(decodeURIComponent(route.request().url())).toContain("ocorrencia_id=in.(");
    await route.continue();
  });

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).click();
  const busca = page.getByPlaceholder("Buscar por cliente, cidade, contato, CNPJ ou ID Auvo");
  await busca.fill(nomeClienteA);
  await page.getByText(nomeClienteA, { exact: true }).first().click();
  await page.locator("main").getByRole("button", { name: "Preventivas", exact: true }).click();
  await expect(page.getByText("Preventivas", { exact: true })).toBeVisible();
  await expect
    .poll(() => planosVistos.some((url) => url.includes(`cliente_id=eq.${clienteA}`)))
    .toBe(true);
  expect(ocorrenciasVistas.every((url) => decodeURIComponent(url).includes("plano_id=in.("))).toBe(
    true,
  );
  expect(
    avaliacoesVistas.every((url) => decodeURIComponent(url).includes("ocorrencia_id=in.(")),
  ).toBe(true);

  await busca.fill(nomeClienteB);
  await page.getByText(nomeClienteB, { exact: true }).first().click();
  await page.locator("main").getByRole("button", { name: "Preventivas", exact: true }).click();
  await expect
    .poll(() => planosVistos.some((url) => url.includes(`cliente_id=eq.${clienteB}`)))
    .toBe(true);
  if (await page.getByRole("button", { name: "Novo plano" }).isVisible()) {
    await page.getByRole("button", { name: "Novo plano" }).click();
    await expect(page.getByText(`Cliente: ${nomeClienteB}`)).toBeVisible();
    await expect(page.getByLabel("Cliente")).toHaveCount(0);
  }
});

test("Calendário abre histórico concluído e mantém o formulário no Auvo (E01-S53 AC-5, AC-7)", async ({
  page,
}) => {
  test.skip(
    !clienteA || !nomeClienteA || !osNumeroConcluida || !auvoUrlConcluida,
    "Requer ocorrência concluída de teste e URL Auvo conhecida; não abre nem altera a task.",
  );
  if (!clienteA || !nomeClienteA || !osNumeroConcluida || !auvoUrlConcluida) {
    throw new Error("Configuração E2E de preventiva concluída ausente.");
  }
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).click();
  const busca = page.getByPlaceholder("Buscar por cliente, cidade, contato, CNPJ ou ID Auvo");
  await busca.fill(nomeClienteA);
  await page.getByText(nomeClienteA, { exact: true }).first().click();
  await page.locator("main").getByRole("button", { name: "Preventivas", exact: true }).click();

  await expect(page.getByText("Calendário de vencimentos")).toBeVisible();
  await page.getByRole("button", { name: "Mês anterior" }).click();
  await page.getByRole("button", { name: "Próximo mês" }).click();

  const linha = page.getByText(`OS ${osNumeroConcluida}`, { exact: false }).first();
  await expect(linha).toBeVisible();
  const historico = linha.locator("xpath=ancestor::article");
  await expect(historico.getByText(/Resultado: (Pendente|OK|Não OK)/)).toBeVisible();
  await expect(historico.getByRole("link", { name: "Abrir formulário no Auvo" })).toHaveAttribute(
    "href",
    auvoUrlConcluida,
  );
});
