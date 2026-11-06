import { expect, test } from "@playwright/test";

// Fixture obrigatória: Supabase/app descartáveis em 127.0.0.1; operador sintético
// sem plano.gerir começa no Cliente A, admin concede/revoga durante a sessão; pgTAP
// cobre a autorização entre Clientes. O cenário de retorno usa a mesma fixture isolada.
const cfg = {
  app: process.env.SSO_S170_APP_URL,
  api: process.env.SSO_S170_SUPABASE_URL,
  banco: process.env.SSO_S170_DB_URL,
  anon: process.env.SSO_S170_ANON_KEY,
  email: process.env.SSO_S170_EMAIL,
  senha: process.env.SSO_S170_SENHA,
  adminEmail: process.env.SSO_S170_ADMIN_EMAIL,
  adminSenha: process.env.SSO_S170_ADMIN_SENHA,
  clienteA: process.env.SSO_S170_CLIENTE_A,
  clienteB: process.env.SSO_S170_CLIENTE_B,
};
const pronto = Object.values(cfg).every((v) => typeof v === "string" && v.length > 0);
const operadorId = "16891000-0000-4000-8000-000000000001";
function local(valor: string): string {
  const url = new URL(valor);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.username || url.password || url.search || url.hash)
    throw new Error("Ensaio S170 exige origem sintética HTTP em 127.0.0.1");
  return url.origin;
}
function conferirBanco(valor: string): void {
  const url = new URL(valor);
  const id = process.env.SSO_RECORTE_ID;
  if (!id || !/^[0-9a-f]{12}$/.test(id) || !['postgres:', 'postgresql:'].includes(url.protocol)
      || url.hostname !== `sso-recorte-${id}-db` || url.username || url.password || url.search || url.hash)
    throw new Error("Banco do ensaio S170 não corresponde ao clone atestado");
}
// Se uma origem for fornecida, rejeitar destino externo mesmo quando faltarem outras variáveis.
if (cfg.app) local(cfg.app);
if (cfg.api) local(cfg.api);
if (cfg.banco) conferirBanco(cfg.banco);
test.use({ storageState: { cookies: [], origins: [] } });
// Requer retorno sintético preparado, navegável no app, com execucao.validar,
// cobertura e evidências prontas; aprovação não finaliza OS nem dispara Auvo.
// O histórico exibido comprova somente os registros retornados, não append-only no banco.
test("validador devolve, reabre e aprova retorno com histórico", async ({ page }) => {
  const caminho = process.env.SSO_S170_RETORNO_PATH;
  if (process.env.SSO_S170_FIXTURE_OBRIGATORIA === "1" && (!pronto || !caminho))
    throw new Error("Fixture S170 obrigatória incompleta");
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
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).first().click();
  await page.getByText("Cliente fechamento sintético", { exact: true }).first().click();
  await page.getByText("Estrutura", { exact: true }).first().click();
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

test("administrador concede e revoga plano.gerir e operador com sessão aberta recebe estado atual", async ({ browser }) => {
  if (process.env.SSO_S170_FIXTURE_OBRIGATORIA === "1" && !pronto)
    throw new Error("Fixture S170 obrigatória incompleta");
  test.skip(!pronto, "Fixture sintética de capacidades S170 não configurada");
  const app = local(cfg.app!);
  const api = local(cfg.api!);
  conferirBanco(cfg.banco!);
  const administrador = await browser.newPage();
  const operador = await browser.newPage();
  for (const current of [administrador, operador]) {
    await current.routeWebSocket("**/*", (socket) => socket.close());
    await current.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || ![app, api].includes(url.origin)) {
        await route.abort();
        return;
      }
      await route.continue();
    });
  }
  async function entrar(current: typeof administrador, email: string, senha: string) {
    await current.goto(`${app}/login`);
    await current.locator("#email").fill(email);
    await current.locator("#password").fill(senha);
    await current.getByRole("button", { name: "Entrar" }).click();
    await expect(current).not.toHaveURL(/\/login/);
  }
  async function abrirCalendario() {
    await operador.goto(app);
    await operador.getByText("PCM · Operação", { exact: true }).first().click();
    await operador.getByText("Clientes", { exact: true }).first().click();
    await operador.getByText("Cliente fechamento sintético", { exact: true }).first().click();
    await operador.getByRole("button", { name: "Preventivas" }).click();
  }
  try {
    // Manter a sessão do operador aberta durante as duas alterações administrativas.
    await entrar(operador, cfg.email!, cfg.senha!);
    const respostasPermissao: string[] = [];
    operador.on("response", async (response) => {
      if (!new URL(response.url()).pathname.endsWith("/rpc/sso_autorizar_acao")) return;
      let resultado = "resposta-indisponivel";
      try {
        const corpo = await response.text();
        if (corpo === "false" || corpo === "true") resultado = corpo;
        else resultado = String(JSON.parse(corpo)?.code ?? "erro").slice(0, 24);
      } catch { /* o status HTTP segue útil sem corpo */ }
      respostasPermissao.push(`${response.status()}:${resultado}`);
    });
    await abrirCalendario();
    try {
      await expect(operador.getByText("Você está sem permissão para gerir o calendário deste Cliente.")).toBeVisible();
    } catch {
      throw new Error(`RPC_AUTORIZAR_ACAO=${respostasPermissao.join(",") || "sem-resposta"}`);
    }
    await expect(operador.getByText("Você está sem permissão para gerir Planos deste Cliente.")).toBeVisible();

    await entrar(administrador, cfg.adminEmail!, cfg.adminSenha!);
    await administrador.getByRole("button", { name: "Configurações" }).click();
    await administrador.getByRole("button", { name: "Capacidades" }).click();
    await expect(administrador.getByRole("heading", { name: "Capacidades e perfis" })).toBeVisible();
    await administrador.getByLabel("Motivo da alteração").fill("Concessão sintética S170");
    await administrador.getByLabel("Usuário", { exact: true }).selectOption(operadorId);
    await administrador.getByLabel("Ação", { exact: true }).selectOption("plano.gerir");
    await administrador.getByLabel("Escopo", { exact: true }).selectOption(cfg.clienteA!);
    await administrador.getByRole("button", { name: "Conceder ação" }).click();
    await expect(administrador.getByText("Alteração registrada.")).toBeVisible();

    await operador.getByRole("button", { name: "Estrutura" }).click();
    await operador.getByRole("button", { name: "Preventivas" }).click();
    await expect(operador.getByRole("region", { name: "Calendário contratual" })).toBeVisible();
    await expect(operador.getByRole("button", { name: "Novo Plano de Manutenção" })).toBeVisible();

    const nomePlano = `Plano autoaprovado S170 ${crypto.randomUUID()}`;
    const nomeRotina = `Rotina autoaprovada S170 ${crypto.randomUUID()}`;
    const planos = operador.getByRole("region", { name: "Planos de Manutenção" });
    await planos.getByRole("button", { name: "Novo Plano de Manutenção" }).click();
    await planos.getByLabel("Nome do Plano").fill(nomePlano);
    await planos.getByRole("button", { name: "Salvar rascunho" }).click();
    await planos.getByRole("button", { name: `Ver Rotinas de ${nomePlano}` }).click();
    const rotinas = operador.getByRole("region", { name: `Rotinas de ${nomePlano}` });
    await rotinas.getByRole("button", { name: "Nova Rotina" }).click();
    const formulario = rotinas.getByRole("region", { name: "Nova Rotina" });
    await formulario.getByLabel("Nome da Rotina").fill(nomeRotina);
    await formulario.getByLabel("Tipo de alvo").selectOption("sistema");
    await formulario.getByLabel("Alvo da Rotina").selectOption({ label: "Sistema sintético" });
    await formulario.getByLabel("Modo").selectOption("calendario");
    await formulario.getByLabel("Intervalo").fill("1");
    await formulario.getByLabel("Unidade da recorrência").selectOption("meses");
    await formulario.getByLabel("Data-base").fill(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
    await formulario.getByLabel("Tempo estimado em minutos").fill("15");
    await formulario.getByLabel("Referência do tempo").selectOption("total");
    await formulario.getByLabel("Instrução").fill("Inspecionar o Sistema sintético.");
    await formulario.getByRole("button", { name: "Salvar Rotina" }).click();
    await expect(rotinas.getByRole("listitem").filter({ hasText: nomeRotina })).toBeVisible();

    const itemPlano = planos.getByRole("listitem").filter({ hasText: nomePlano });
    await itemPlano.getByRole("button", { name: `Enviar ${nomePlano} para revisão` }).click();
    await itemPlano.getByRole("button", { name: "Confirmar envio para revisão" }).click();
    await expect(itemPlano).toContainText("em_revisao");
    await itemPlano.getByRole("button", { name: `Aprovar ${nomePlano}` }).click();
    await itemPlano.getByLabel("Início da vigência").fill(new Date().toISOString().slice(0, 10));
    await itemPlano.getByRole("button", { name: "Confirmar aprovação" }).click();
    await expect(itemPlano).toContainText("aprovado");

    await administrador.getByLabel("Motivo da alteração").fill("Revogação sintética S170");
    const concessoes = administrador.getByRole("heading", { name: "Concessões" }).locator("..");
    const concessao = concessoes.getByText(/Gerir Plano de Manutenção/).locator("..");
    await concessao.getByRole("button", { name: "Revogar" }).click();
    await expect(administrador.getByText("Alteração registrada.")).toBeVisible();

    await operador.getByRole("button", { name: "Estrutura" }).click();
    await operador.getByRole("button", { name: "Preventivas" }).click();
    await expect(operador.getByText("Você está sem permissão para gerir o calendário deste Cliente.")).toBeVisible();
    await expect(operador.getByText("Você está sem permissão para gerir Planos deste Cliente.")).toBeVisible();
  } finally {
    await Promise.all([administrador.close(), operador.close()]);
  }
});
