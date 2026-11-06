import { expect, test } from "@playwright/test";

// Executar apenas com servidor e dois Clientes sintéticos de um ambiente descartável.
const base = process.env.S165_E2E_BASE_URL;
const api = process.env.S165_E2E_SUPABASE_URL;
const email = process.env.S165_E2E_EMAIL;
const senha = process.env.S165_E2E_SENHA;
const clienteA = process.env.S165_E2E_CLIENTE_A;
const clienteB = process.env.S165_E2E_CLIENTE_B;
const planoRevisao = process.env.S165_E2E_PLANO_REVISAO;
const vigencia = process.env.S165_E2E_VIGENCIA;
const rotinaHistorica = process.env.S165_E2E_ROTINA_HISTORICA;
const versaoHistorica = process.env.S165_E2E_VERSAO_HISTORICA;

test.use({ storageState: { cookies: [], origins: [] } });
test("cria rascunho no Cliente A sem apresentá-lo no Cliente B", async ({ page }) => {
  test.skip(!base || !api || !email || !senha || !clienteA || !clienteB, "Requer fixture S165 descartável de dois Clientes.");
  const url = new URL(base!);
  const apiUrl = new URL(api!);
  if ([url, apiUrl].some((u) => u.protocol !== "http:" || u.hostname !== "127.0.0.1" || u.username || u.password || u.search || u.hash)) throw new Error("S165 E2E exige origens sintéticas em 127.0.0.1.");
  if (clienteA === clienteB) throw new Error("A fixture exige Clientes distintos.");
  await page.routeWebSocket("**/*", (socket) => socket.close());
  await page.route("**/*", async (route) => {
    const destino = new URL(route.request().url());
    if (destino.protocol !== "http:" || ![url.origin, apiUrl.origin].includes(destino.origin)) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  const nome = `Plano sintético ${crypto.randomUUID()}`;
  let loginNaApi = false;
  page.on("request", (r) => { if (r.url().startsWith(`${apiUrl.origin}/auth/v1/token`) && r.method() === "POST") loginNaApi = true; });
  await page.goto(`${url.origin}/login`);
  await page.getByLabel("E-mail").fill(email!);
  await page.getByLabel("Senha").fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  expect(loginNaApi).toBe(true);
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).first().click();
  await page.getByText(clienteA!, { exact: true }).first().click();
  await page.getByRole("region", { name: "Operação" }).getByRole("button", { name: "Preventivas", exact: true }).click();
  const planos = page.getByRole("region", { name: "Planos de Manutenção" });
  await planos.getByRole("button", { name: "Novo Plano de Manutenção" }).click();
  await planos.getByLabel("Nome do Plano").fill(nome);
  await planos.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(planos.getByRole("button", { name: `Ver Rotinas de ${nome}` })).toBeVisible();
  await page.getByText("Clientes", { exact: true }).first().click();
  await page.getByText(clienteB!, { exact: true }).first().click();
  await page.getByRole("region", { name: "Operação" }).getByRole("button", { name: "Preventivas", exact: true }).click();
  const planosB = page.getByRole("region", { name: "Planos de Manutenção" });
  await expect(planosB.getByText(`Planos de ${clienteB}. Salvar rascunho não cria ocorrências nem tarefas.`)).toBeVisible();
  await expect(planosB.getByText("Carregando Planos..." )).toBeHidden();
  await expect(planosB.getByText("Não foi possível carregar Planos.")).toHaveCount(0);
  await expect(planosB.getByText(nome, { exact: true })).toHaveCount(0);
});

// Fixture adicional deve preparar uma revisão sintética com impactos resolvidos e questionário histórico.
// A aprovação é real; teste não substitui inspeção do snapshot no banco nem prova RLS.
test("aprova revisão preparada e mantém questionário histórico acessível", async ({ page }) => {
  test.skip(!base || !api || !email || !senha || !clienteA || !planoRevisao || !vigencia || !rotinaHistorica || !versaoHistorica, "Requer revisão S165 sintética preparada.");
  const app = new URL(base!); const backend = new URL(api!);
  if ([app, backend].some((u) => u.protocol !== "http:" || u.hostname !== "127.0.0.1" || u.username || u.password || u.search || u.hash)) throw new Error("S165 E2E exige origens sintéticas em 127.0.0.1.");
  await page.routeWebSocket("**/*", (socket) => socket.close());
  await page.route("**/*", async (route) => {
    const destino = new URL(route.request().url());
    if (destino.protocol !== "http:" || ![app.origin, backend.origin].includes(destino.origin)) return route.abort("blockedbyclient");
    return route.continue();
  });
  let loginNaApi = false;
  page.on("request", (r) => { if (r.url().startsWith(`${backend.origin}/auth/v1/token`) && r.method() === "POST") loginNaApi = true; });
  await page.goto(`${app.origin}/login`);
  await page.getByLabel("E-mail").fill(email!); await page.getByLabel("Senha").fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/); expect(loginNaApi).toBe(true);
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).first().click();
  await page.getByText(clienteA!, { exact: true }).first().click();
  await page.getByRole("region", { name: "Operação" }).getByRole("button", { name: "Preventivas", exact: true }).click();
  const planos = page.getByRole("region", { name: "Planos de Manutenção" });
  await planos.getByRole("button", { name: `Ver Rotinas de ${planoRevisao}` }).click();
  await page.getByRole("button", { name: "Aprovar revisão de versão" }).click();
  await page.getByLabel("Início da vigência").fill(vigencia!);
  const resposta = page.waitForResponse((r) => r.url().startsWith(`${backend.origin}/rest/v1/rpc/sso_aprovar_revisao_mediada`) && r.request().method() === "POST");
  await page.getByRole("button", { name: "Confirmar aprovação" }).click();
  expect((await resposta).status()).toBe(200);
  await planos.getByLabel("Versão do Plano").selectOption(versaoHistorica!);
  await planos.getByRole("button", { name: `Ver questionário de ${rotinaHistorica}` }).click();
  await expect(page.getByRole("region", { name: "Questionário histórico" })).toBeVisible();
});
