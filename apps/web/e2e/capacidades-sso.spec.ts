import { expect, test } from "@playwright/test";

// Fixture obrigatória: Supabase/app descartáveis em 127.0.0.1; operador sintético
// com plano.gerir individual no Cliente A e sem concessão no Cliente B.
// Este cenário consulta autorização real; não comprova por si aprovação ou auditoria.
const cfg = {
  app: process.env.SSO_S170_APP_URL,
  api: process.env.SSO_S170_SUPABASE_URL,
  banco: process.env.SSO_S170_DB_URL,
  anon: process.env.SSO_S170_ANON_KEY,
  email: process.env.SSO_S170_EMAIL,
  senha: process.env.SSO_S170_SENHA,
  clienteA: process.env.SSO_S170_CLIENTE_A,
  clienteB: process.env.SSO_S170_CLIENTE_B,
};
const pronto = Object.values(cfg).every((v) => typeof v === "string" && v.length > 0);
function local(valor: string): string {
  const url = new URL(valor);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.username || url.password || url.search || url.hash)
    throw new Error("Ensaio S170 exige origem sintética HTTP em 127.0.0.1");
  return url.origin;
}
function conferirBanco(valor: string): void {
  const url = new URL(valor);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1')
    throw new Error("Banco do ensaio S170 deve estar em 127.0.0.1");
}
// Se uma origem for fornecida, rejeitar destino externo mesmo quando faltarem outras variáveis.
if (cfg.app) local(cfg.app);
if (cfg.api) local(cfg.api);
if (cfg.banco) conferirBanco(cfg.banco);
test.use({ storageState: { cookies: [], origins: [] } });
test("sessão real mantém gestão limitada ao Cliente autorizado", async ({ page, request }) => {
  test.skip(!pronto, "Fixture S170 isolada não configurada");
  const app = local(cfg.app!);
  const api = local(cfg.api!);
  conferirBanco(cfg.banco!);
  const clienteA = cfg.clienteA!;
  const clienteB = cfg.clienteB!;
  if (!/^[0-9a-f-]{36}$/i.test(clienteA) || !/^[0-9a-f-]{36}$/i.test(clienteB) || clienteA === clienteB)
    throw new Error("Clientes sintéticos inválidos");
  await page.routeWebSocket("**/*", (socket) => socket.close());
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || ![app, api].includes(url.origin)) {
      await route.abort();
      return;
    }
    await route.continue();
  });
  let loginNaApi = false;
  page.on("request", (r) => {
    if (r.url().startsWith(`${api}/auth/v1/token`) && r.method() === "POST") loginNaApi = true;
  });
  await page.goto(`${app}/login`);
  await page.locator("#email").fill(cfg.email!);
  await page.locator("#password").fill(cfg.senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  expect(loginNaApi).toBe(true);
  const sessao = await request.post(`${api}/auth/v1/token?grant_type=password`, {
    headers: { apikey: cfg.anon! }, data: { email: cfg.email!, password: cfg.senha! }, maxRedirects: 0,
  });
  expect(sessao.status()).toBe(200);
  const { access_token: token } = await sessao.json();
  expect(typeof token).toBe("string");
  for (const [cliente, esperado] of [[clienteA, true], [clienteB, false]] as const) {
    const resposta = await request.post(`${api}/rest/v1/rpc/sso_autorizar_acao`, {
      headers: { apikey: cfg.anon!, Authorization: `Bearer ${token}`, "Content-Profile": "config", "Accept-Profile": "config" },
      data: { p_acao: "plano.gerir", p_cliente_id: cliente }, maxRedirects: 0,
    });
    expect(resposta.status()).toBe(200);
    expect(await resposta.json()).toBe(esperado);
  }
});

// Requer retorno sintético preparado, navegável no app, com execucao.validar,
// cobertura e evidências prontas; aprovação não finaliza OS nem dispara Auvo.
// O histórico exibido comprova somente os registros retornados, não append-only no banco.
test("validador devolve, reabre e aprova retorno com histórico", async ({ page }) => {
  const caminho = process.env.SSO_S170_RETORNO_PATH;
  test.skip(!pronto || !caminho, "Fixture sintética de retorno S170 não configurada");
  const app = local(cfg.app!);
  const api = local(cfg.api!);
  conferirBanco(cfg.banco!);
  if (!caminho!.startsWith("/") || caminho!.startsWith("//") || new URL(caminho!, app).origin !== app)
    throw new Error("Caminho do retorno isolado inválido");
  await page.routeWebSocket("**/*", (socket) => socket.close());
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || ![app, api].includes(url.origin)) {
      await route.abort();
      return;
    }
    await route.continue();
  });
  let loginNaApi = false;
  page.on("request", (r) => { if (r.url().startsWith(`${api}/auth/v1/token`) && r.method() === "POST") loginNaApi = true; });
  await page.goto(`${app}/login`);
  await page.locator("#email").fill(cfg.email!);
  await page.locator("#password").fill(cfg.senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  expect(loginNaApi).toBe(true);
  await page.goto(new URL(caminho!, app).href);
  // HomePage mantém Cliente e aba em estado React: navegar pela interface real.
  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  await page.getByRole("button", { name: "Cliente fechamento sintético", exact: true }).click();
  await page.getByRole("button", { name: "Estrutura", exact: true }).click();
  const retorno = page.getByRole("listitem").filter({ hasText: "16891000-0000-4000-8000-000000000018" });
  await retorno.getByRole("button", { name: "Conferir evidências" }).click();
  const decisoes = page.getByRole("region", { name: "Decisões do retorno" });
  await expect(decisoes).toBeVisible();
  await decisoes.getByLabel("Decisão").selectOption("devolver");
  await decisoes.getByLabel("Motivo").fill("Devolução sintética S170");
  await decisoes.getByRole("button", { name: "Registrar decisão" }).click();
  await expect(decisoes.getByText(/Devolução sintética S170/)).toBeVisible();
  await decisoes.getByLabel("Decisão").selectOption("reabrir");
  await decisoes.getByLabel("Motivo").fill("Reabertura sintética S170");
  await decisoes.getByRole("button", { name: "Registrar decisão" }).click();
  await expect(decisoes.getByText(/Reabertura sintética S170/)).toBeVisible();
  const conferencia = page.getByRole("region", { name: "Conferência estrutural" });
  await expect(conferencia).toBeVisible();
  await conferencia.getByLabel("Justificativa").fill("Conferência sintética S170");
  await conferencia.getByRole("checkbox", { name: /Conferi a evidência/ }).check();
  await conferencia.getByRole("button", { name: /Conferir na revisão/ }).click();
  await expect(conferencia.getByText(/Conferência sintética S170/)).toBeVisible();
  const aprovacao = page.getByRole("region", { name: "Atestação e aprovação PCM" });
  await expect(aprovacao).toBeVisible();
  await aprovacao.getByLabel("Justificativa").fill("Aprovação sintética S170");
  await aprovacao.getByRole("checkbox", { name: /Conferi o retorno/ }).check();
  await aprovacao.getByRole("button", { name: "Atestar e aprovar retorno" }).click();
  await expect(aprovacao.getByText(/Retorno aprovado pelo PCM/)).toBeVisible();
  await expect(aprovacao.getByText(/Aprovação sintética S170/)).toBeVisible();
});
