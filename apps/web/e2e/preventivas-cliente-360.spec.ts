import { expect, test } from "@playwright/test";

const clienteA = process.env.E2E_PREVENTIVAS_CLIENTE_A;
const clienteB = process.env.E2E_PREVENTIVAS_CLIENTE_B;
const nomeClienteA = process.env.E2E_PREVENTIVAS_NOME_A;
const nomeClienteB = process.env.E2E_PREVENTIVAS_NOME_B;

test.skip(
  !clienteA || !clienteB || !nomeClienteA || !nomeClienteB,
  "Requer sessão autenticada e dois clientes de teste existentes; não cria task Auvo.",
);

test("Preventivas no 360 isola cliente em consultas e formulário (E01-S53 AC-8)", async ({
  page,
}) => {
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
