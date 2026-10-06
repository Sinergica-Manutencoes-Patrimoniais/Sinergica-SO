import { expect, test, type Page } from "@playwright/test";

const clienteA = process.env.E2E_CLIENTE_360_A;
const clienteB = process.env.E2E_CLIENTE_360_B;
const nomeClienteA = process.env.E2E_CLIENTE_360_NOME_A;
const nomeClienteB = process.env.E2E_CLIENTE_360_NOME_B;
const emailSomenteLeitura = process.env.E2E_CLIENTE_360_LEITURA_EMAIL;
const senhaSomenteLeitura = process.env.E2E_CLIENTE_360_LEITURA_PASSWORD;

async function abrirCliente360(page: Page, nome: string) {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).click();
  const busca = page.getByPlaceholder("Buscar por cliente, cidade, contato, CNPJ ou ID Auvo");
  await busca.fill(nome);
  await page.getByText(nome, { exact: true }).first().click();
  await expect(page.getByLabel("Contexto do cliente")).toBeVisible();
}

test.describe("Cliente 360 cockpit — E01-S163", () => {
  test("isola leituras entre dois clientes e oferece as três visões preventivas", async ({ page }) => {
    test.skip(
      !clienteA || !clienteB || !nomeClienteA || !nomeClienteB,
      "Requer dois clientes de fixture, sem criar dados no Supabase de produção.",
    );
    if (!clienteA || !clienteB || !nomeClienteA || !nomeClienteB) return;

    const consultasPlanos: string[] = [];
    await page.route("**/rest/v1/planos_preventivos*", async (route) => {
      consultasPlanos.push(route.request().url());
      await route.continue();
    });

    await abrirCliente360(page, nomeClienteA);
    await page.getByRole("button", { name: "Preventivas", exact: true }).click();
    await expect(page.getByRole("button", { name: "Lista", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Timeline", exact: true }).click();
    await page.getByRole("button", { name: "Calendário", exact: true }).click();
    await expect(page.getByRole("button", { name: "Calendário", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect
      .poll(() => consultasPlanos.some((url) => url.includes(`cliente_id=eq.${clienteA}`)))
      .toBe(true);

    await abrirCliente360(page, nomeClienteB);
    await page.getByRole("button", { name: "Preventivas", exact: true }).click();
    await expect
      .poll(() => consultasPlanos.some((url) => url.includes(`cliente_id=eq.${clienteB}`)))
      .toBe(true);
  });

  test("mantém apontamentos de visita fora da operação e expõe filtros e ações rápidas", async ({
    page,
  }) => {
    test.skip(
      !nomeClienteA,
      "Requer cliente de fixture com OS de manutenção e apontamentos de visita conhecidos.",
    );
    if (!nomeClienteA) return;

    await abrirCliente360(page, nomeClienteA);
    await expect(page.getByLabel("Ações rápidas do cliente")).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo chamado" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova OS" })).toBeVisible();
    await page.getByRole("button", { name: "OS", exact: true }).click();
    await expect(page.getByText(/Início visita|Fim visita/i)).toHaveCount(0);

    await page.getByRole("button", { name: "Componentes", exact: true }).click();
    const busca = page.getByPlaceholder("Buscar por nome ou identificador");
    await expect(busca).toBeVisible();
    await busca.fill("resultado impossível de propósito");
    await expect(page.getByText("Nenhum componente para estes filtros.")).toBeVisible();
    await page.getByRole("button", { name: "Limpar" }).click();
  });

  test("um papel somente leitura não recebe ações de escrita", async ({ browser }) => {
    test.skip(
      !nomeClienteA || !emailSomenteLeitura || !senhaSomenteLeitura,
      "Requer uma conta PCM somente leitura dedicada ao E2E.",
    );
    if (!nomeClienteA || !emailSomenteLeitura || !senhaSomenteLeitura) return;

    const contexto = await browser.newContext();
    const page = await contexto.newPage();
    await page.goto("/login");
    await page.locator("#email").fill(emailSomenteLeitura);
    await page.locator("#password").fill(senhaSomenteLeitura);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await abrirCliente360(page, nomeClienteA);
    await expect(page.getByLabel("Ações rápidas do cliente")).toHaveCount(0);
    await contexto.close();
  });
});
