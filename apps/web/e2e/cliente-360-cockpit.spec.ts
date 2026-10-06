import { type Page, expect, test } from "@playwright/test";

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
  await expect(page.getByLabel("Contexto do cliente")).toBeVisible({ timeout: 15_000 });
}

async function autenticarContextoSomenteLeitura(page: Page, email: string, senha: string) {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase não configurado para o E2E.");

  const resposta = await page.request.post(`${url}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey },
    data: { email, password: senha },
  });
  expect(resposta.ok()).toBe(true);
  const sessao = await resposta.json();
  const chaveStorage = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  await page.addInitScript(
    ({ chave, valor }) => window.localStorage.setItem(chave, JSON.stringify(valor)),
    { chave: chaveStorage, valor: sessao },
  );
}

test.describe("Cliente 360 cockpit — E01-S163", () => {
  test("isola leituras entre dois clientes e oferece as três visões preventivas", async ({
    page,
  }) => {
    test.setTimeout(60_000);
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
    await page.getByLabel("Áreas do Cliente").getByRole("button", { name: "Preventivas" }).click();
    await expect(page.getByRole("button", { name: "Lista", exact: true })).toBeVisible();
    const visoesPreventivas = page.getByRole("group", { name: "Visão de preventivas" });
    await visoesPreventivas.getByRole("button", { name: "Timeline", exact: true }).click();
    await visoesPreventivas.getByRole("button", { name: "Calendário", exact: true }).click();
    await expect(
      visoesPreventivas.getByRole("button", { name: "Calendário", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => consultasPlanos.some((url) => url.includes(`cliente_id=eq.${clienteA}`)))
      .toBe(true);

    await abrirCliente360(page, nomeClienteB);
    await page.getByLabel("Áreas do Cliente").getByRole("button", { name: "Preventivas" }).click();
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
    await page.getByLabel("Áreas do Cliente").getByRole("button", { name: "OS" }).click();
    await expect(page.getByText(/Início visita|Fim visita/i)).toHaveCount(0);

    await page.getByLabel("Áreas do Cliente").getByRole("button", { name: "Componentes" }).click();
    const busca = page.getByPlaceholder("Buscar por nome ou identificador");
    await expect(busca).toBeVisible();
    await busca.fill("resultado impossível de propósito");
    await expect(page.getByText(/Nenhum componente/)).toBeVisible();
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
    await autenticarContextoSomenteLeitura(page, emailSomenteLeitura, senhaSomenteLeitura);
    await abrirCliente360(page, nomeClienteA);
    await expect(page.getByLabel("Ações rápidas do cliente")).toHaveCount(0);
    await contexto.close();
  });
});
