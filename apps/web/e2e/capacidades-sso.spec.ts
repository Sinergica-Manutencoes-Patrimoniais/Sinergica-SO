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
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Ensaio S170 exige origem sintética HTTP em 127.0.0.1");
  return url.origin;
}
function exigir(valor: string | undefined, nome: string): string {
  if (!valor) throw new Error(`Fixture S170 sem ${nome}.`);
  return valor;
}
function conferirBanco(valor: string): void {
  const url = new URL(valor);
  const id = process.env.SSO_RECORTE_ID;
  if (
    !id ||
    !/^[0-9a-f]{12}$/.test(id) ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== `sso-recorte-${id}-db` ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Banco do ensaio S170 não corresponde ao clone atestado");
}
function marcarDiagnosticoS170(tipo: string, descricao: string) {
  const marcacao = test.info().annotations.find((item) => item.type === tipo);
  if (marcacao) marcacao.description = descricao;
  else test.info().annotations.push({ type: tipo, description: descricao });
}
const marcarEtapaS170 = (etapa: string) => marcarDiagnosticoS170("s170-etapa", etapa);
// Se uma origem for fornecida, rejeitar destino externo mesmo quando faltarem outras variáveis.
if (cfg.app) local(cfg.app);
if (cfg.api) local(cfg.api);
if (cfg.banco) conferirBanco(cfg.banco);
test.use({ storageState: { cookies: [], origins: [] } });
// Requer retorno sintético preparado, navegável no app, com execucao.validar,
// cobertura e evidências prontas; aprovação não finaliza OS nem dispara Auvo.
// O histórico exibido comprova somente os registros retornados, não append-only no banco.
test("validador devolve, reabre e aprova retorno com histórico", async ({ page }) => {
  test.setTimeout(120_000);
  marcarEtapaS170("preparar e autenticar");
  const caminho = process.env.SSO_S170_RETORNO_PATH;
  if (process.env.SSO_S170_FIXTURE_OBRIGATORIA === "1" && (!pronto || !caminho))
    throw new Error("Fixture S170 obrigatória incompleta");
  test.skip(!pronto || !caminho, "Fixture sintética de retorno S170 não configurada");
  const caminhoRetorno = exigir(caminho, "SSO_S170_RETORNO_PATH");
  const app = local(exigir(cfg.app, "SSO_S170_APP_URL"));
  const api = local(exigir(cfg.api, "SSO_S170_SUPABASE_URL"));
  conferirBanco(exigir(cfg.banco, "SSO_S170_DB_URL"));
  if (
    !caminhoRetorno.startsWith("/") ||
    caminhoRetorno.startsWith("//") ||
    new URL(caminhoRetorno, app).origin !== app
  )
    throw new Error("Caminho do retorno isolado inválido");
  const respostasRpc: string[] = [];
  let atestacoesDiagnostico = "sem-resposta";
  page.on("response", async (response) => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith("/rest/v1/rpc/sso_")) return;
    if (url.pathname.endsWith("/rpc/sso_listar_atestacoes_pcm_mediada") && response.ok()) {
      try {
        const linhas = await response.json();
        const justificativas = Array.isArray(linhas)
          ? linhas.map((linha) => String(linha.justificativa ?? "").slice(0, 48)).join("|")
          : "formato-invalido";
        atestacoesDiagnostico = `${response.status()}:linhas=${Array.isArray(linhas) ? linhas.length : "formato-invalido"}:justificativas=${justificativas}`;
        marcarDiagnosticoS170("s170-rpc", `HISTORICO=${atestacoesDiagnostico}`);
      } catch {
        atestacoesDiagnostico = `${response.status()}:corpo-invalido`;
      }
    }
    let codigo = "ok";
    if (!response.ok()) {
      try {
        codigo = String((await response.json())?.code ?? "erro").slice(0, 24);
      } catch {
        codigo = "erro";
      }
    }
    respostasRpc.push(`${url.pathname.split("/").pop()}:${response.status()}:${codigo}`);
    marcarDiagnosticoS170("s170-rpc", respostasRpc.slice(-4).join(","));
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/rest/v1/rpc/sso_")) {
      respostasRpc.push(`${url.pathname.split("/").pop()}:falha-rede`);
      marcarDiagnosticoS170("s170-rpc", respostasRpc.slice(-4).join(","));
    }
  });
  await page.routeWebSocket("**/*", (socket) => socket.close());
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      ![app, api].includes(url.origin)
    ) {
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
  await page.locator("#email").fill(exigir(cfg.email, "SSO_S170_EMAIL"));
  await page.locator("#password").fill(exigir(cfg.senha, "SSO_S170_SENHA"));
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  expect(loginNaApi).toBe(true);
  marcarEtapaS170("abrir retorno no Cliente 360");
  await page.goto(new URL(caminhoRetorno, app).href);
  // HomePage mantém Cliente e aba em estado React: navegar pela interface real.
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).first().click();
  await page.getByText("Cliente fechamento sintético", { exact: true }).first().click();
  await page.getByText("Estrutura", { exact: true }).first().click();
  const retorno = page
    .getByRole("listitem")
    .filter({ hasText: "16891000-0000-4000-8000-000000000018" });
  await retorno.getByRole("button", { name: "Conferir evidências" }).click();
  const decisoes = page.getByRole("region", { name: "Decisões do retorno" });
  marcarEtapaS170("devolver retorno");
  await expect(decisoes).toBeVisible();
  await decisoes.getByLabel("Decisão").selectOption("devolver");
  await decisoes.getByLabel("Motivo").fill("Devolução sintética S170");
  await decisoes.getByRole("button", { name: "Registrar decisão" }).click();
  await expect(decisoes.getByText(/Devolução sintética S170/)).toBeVisible();
  await decisoes.getByLabel("Decisão").selectOption("reabrir");
  await decisoes.getByLabel("Motivo").fill("Reabertura sintética S170");
  await decisoes.getByRole("button", { name: "Registrar decisão" }).click();
  await expect(decisoes.getByText(/Reabertura sintética S170/)).toBeVisible();
  marcarEtapaS170("reabrir retorno");
  const conferencia = page.getByRole("region", { name: "Conferência estrutural" });
  marcarEtapaS170("conferir evidência estrutural");
  await expect(conferencia).toBeVisible();
  await conferencia.getByLabel("Justificativa").fill("Conferência sintética S170");
  await conferencia.getByRole("checkbox", { name: /Conferi a evidência/ }).check();
  await conferencia.getByRole("button", { name: /Conferir na revisão/ }).click();
  await expect(conferencia.getByText(/Conferência sintética S170/)).toBeVisible();
  const aprovacao = page.getByRole("region", { name: "Atestação e aprovação PCM" });
  marcarEtapaS170("aprovar retorno no PCM");
  await expect(aprovacao).toBeVisible();
  await aprovacao.getByLabel("Justificativa").fill("Aprovação sintética S170");
  await aprovacao.getByRole("checkbox", { name: /Conferi o retorno/ }).check();
  await aprovacao.getByRole("button", { name: "Atestar e aprovar retorno" }).click();
  await expect(aprovacao.getByText(/Retorno aprovado pelo PCM/)).toBeVisible();
  try {
    await expect(
      aprovacao.getByRole("listitem").filter({ hasText: "Aprovação sintética S170" }),
    ).toBeVisible({ timeout: 15_000 });
  } catch {
    const estado = (await aprovacao.innerText().catch(() => "sem-texto"))
      .replace(/\s+/g, " ")
      .slice(0, 800);
    const linhasVisiveis = (
      await aprovacao
        .getByRole("listitem")
        .allTextContents()
        .catch(() => [])
    )
      .join(" | ")
      .replace(/\s+/g, " ")
      .slice(0, 500);
    const alertas = (
      await aprovacao
        .getByRole("alert")
        .allTextContents()
        .catch(() => [])
    )
      .join(" | ")
      .replace(/\s+/g, " ")
      .slice(0, 300);
    marcarDiagnosticoS170(
      "s170-rpc",
      `HISTORICO=${atestacoesDiagnostico}; LINHAS=${linhasVisiveis}; ALERTAS=${alertas}; ${respostasRpc.slice(-4).join(",")}`,
    );
    throw new Error(
      `S170_HISTORICO=${estado}; LINHAS=${linhasVisiveis}; ALERTAS=${alertas}; RPC=${atestacoesDiagnostico}`,
    );
  }
});

test("administrador concede e revoga plano.gerir e operador com sessão aberta recebe estado atual", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  if (process.env.SSO_S170_FIXTURE_OBRIGATORIA === "1" && !pronto)
    throw new Error("Fixture S170 obrigatória incompleta");
  test.skip(!pronto, "Fixture sintética de capacidades S170 não configurada");
  const app = local(exigir(cfg.app, "SSO_S170_APP_URL"));
  const api = local(exigir(cfg.api, "SSO_S170_SUPABASE_URL"));
  conferirBanco(exigir(cfg.banco, "SSO_S170_DB_URL"));
  const administrador = await browser.newPage();
  const operador = await browser.newPage();
  for (const current of [administrador, operador]) {
    await current.routeWebSocket("**/*", (socket) => socket.close());
    await current.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (
        url.protocol !== "http:" ||
        url.hostname !== "127.0.0.1" ||
        ![app, api].includes(url.origin)
      ) {
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
    let respostaAuth = "sem-resposta";
    current.on("response", async (response) => {
      if (new URL(response.url()).pathname !== "/auth/v1/token") return;
      if (response.ok()) respostaAuth = `${response.status()}:ok`;
      else {
        let codigo = "erro";
        try {
          const corpo = await response.json();
          codigo = String(corpo.error_code ?? corpo.code ?? corpo.error ?? "erro").slice(0, 40);
        } catch {
          /* só status */
        }
        respostaAuth = `${response.status()}:${codigo}`;
      }
    });
    current.on("requestfailed", (request) => {
      if (new URL(request.url()).pathname === "/auth/v1/token") respostaAuth = "falha-rede";
    });
    await current.getByRole("button", { name: "Entrar" }).click();
    try {
      await expect(current).not.toHaveURL(/\/login/);
    } catch {
      const alertas = (await current.getByRole("alert").allTextContents())
        .join(" ")
        .replace(/\s+/g, " ")
        .slice(0, 160);
      throw new Error(`LOGIN_STAYED; AUTH=${respostaAuth}; alerta=${alertas || "sem-alerta"}`);
    }
  }
  async function abrirCalendario() {
    await operador.goto(app);
    await operador.getByText("PCM · Operação", { exact: true }).first().click();
    await operador.getByText("Clientes", { exact: true }).first().click();
    await operador.getByText("Cliente fechamento sintético", { exact: true }).first().click();
    await operador
      .getByRole("navigation", { name: "Áreas do Cliente 360" })
      .getByRole("button", { name: "Preventivas" })
      .click();
  }
  try {
    // Manter a sessão do operador aberta durante as duas alterações administrativas.
    marcarEtapaS170("login do operador para revogação");
    await entrar(
      operador,
      exigir(cfg.email, "SSO_S170_EMAIL"),
      exigir(cfg.senha, "SSO_S170_SENHA"),
    );
    const respostasPermissao: string[] = [];
    const respostasAlvo: string[] = [];
    operador.on("response", async (response) => {
      const url = new URL(response.url());
      if (!url.pathname.endsWith("/rpc/sso_listar_alvos_plano")) return;
      let resultado = "corpo-indisponivel";
      try {
        const corpo = await response.json();
        resultado = Array.isArray(corpo)
          ? `linhas=${corpo.length}`
          : `codigo=${String(corpo.code ?? "erro").slice(0, 24)}`;
      } catch {
        /* status segue útil */
      }
      respostasAlvo.push(`${response.status()}:${resultado}`);
    });
    operador.on("requestfailed", (request) => {
      if (new URL(request.url()).pathname.endsWith("/rpc/sso_listar_alvos_plano"))
        respostasAlvo.push("falha-rede");
    });
    operador.on("response", async (response) => {
      if (!new URL(response.url()).pathname.endsWith("/rpc/sso_autorizar_acao")) return;
      let resultado = "resposta-indisponivel";
      try {
        const corpo = await response.text();
        if (corpo === "false" || corpo === "true") resultado = corpo;
        else resultado = String(JSON.parse(corpo)?.code ?? "erro").slice(0, 24);
      } catch {
        /* o status HTTP segue útil sem corpo */
      }
      respostasPermissao.push(
        `${new URL(response.url()).pathname.split("/").pop()}:${response.status()}:${resultado}`,
      );
    });
    operador.on("requestfailed", (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith("/rpc/sso_autorizar_acao"))
        respostasPermissao.push("sso_autorizar_acao:falha-rede");
    });
    marcarEtapaS170("abrir calendário sem capacidade");
    await abrirCalendario();
    marcarEtapaS170("confirmar bloqueio inicial do operador");
    try {
      await expect(
        operador.getByText("Você está sem permissão para gerir o calendário deste Cliente."),
      ).toBeVisible();
    } catch {
      throw new Error(`RPC_AUTORIZAR_ACAO=${respostasPermissao.join(",") || "sem-resposta"}`);
    }
    await expect(
      operador.getByText("Você está sem permissão para gerir Planos deste Cliente."),
    ).toBeVisible();

    await entrar(
      administrador,
      exigir(cfg.adminEmail, "SSO_S170_ADMIN_EMAIL"),
      exigir(cfg.adminSenha, "SSO_S170_ADMIN_SENHA"),
    );
    marcarEtapaS170("abrir configurações administrativas");
    await administrador.getByRole("button", { name: "Configurações" }).click();
    await administrador.getByRole("button", { name: "Capacidades" }).click();
    marcarEtapaS170("abrir gestão de capacidades");
    await expect(
      administrador.getByRole("heading", { name: "Capacidades e perfis" }),
    ).toBeVisible();
    await administrador.getByLabel("Motivo da alteração").fill("Concessão sintética S170");
    await administrador.getByLabel("Usuário", { exact: true }).selectOption(operadorId);
    await administrador.getByLabel("Ação", { exact: true }).selectOption("plano.gerir");
    await administrador
      .getByLabel("Escopo", { exact: true })
      .selectOption(exigir(cfg.clienteA, "SSO_S170_CLIENTE_A"));
    await administrador.getByRole("button", { name: "Conceder ação" }).click();
    await expect(administrador.getByText("Alteração registrada.")).toBeVisible();

    marcarEtapaS170("confirmar concessão em sessão existente");
    const abasCliente = operador.getByRole("navigation", { name: "Áreas do Cliente 360" });
    await abasCliente.getByRole("button", { name: "Estrutura" }).click();
    await abasCliente.getByRole("button", { name: "Preventivas" }).click();
    await expect(operador.getByRole("region", { name: "Calendário contratual" })).toBeVisible();
    await expect(operador.getByRole("button", { name: "Novo Plano de Manutenção" })).toBeVisible();

    marcarEtapaS170("criar plano autoaprovado");
    const nomePlano = `Plano autoaprovado S170 ${crypto.randomUUID()}`;
    const nomeRotina = `Rotina autoaprovada S170 ${crypto.randomUUID()}`;
    const planos = operador.getByRole("region", { name: "Planos de Manutenção" });
    marcarEtapaS170("abrir formulário do Plano");
    await planos.getByRole("button", { name: "Novo Plano de Manutenção" }).click();
    await planos.getByLabel("Nome do Plano").fill(nomePlano);
    marcarEtapaS170("salvar rascunho do Plano");
    await planos.getByRole("button", { name: "Salvar rascunho" }).click();
    marcarEtapaS170("verificar botão de Rotinas do Plano");
    const abrirRotinas = planos.getByRole("button", { name: `Ver Rotinas de ${nomePlano}` });
    await expect(abrirRotinas).toBeVisible({ timeout: 15_000 });
    await abrirRotinas.click({ timeout: 15_000 });
    marcarEtapaS170("esperar painel Rotinas do Plano");
    const rotinas = operador.getByRole("region", { name: `Rotinas de ${nomePlano}` });
    await expect(rotinas).toBeVisible({ timeout: 15_000 });
    marcarEtapaS170("verificar botão Nova Rotina");
    const novaRotina = rotinas.getByRole("button", { name: "Nova Rotina" });
    await expect(novaRotina).toBeVisible({ timeout: 15_000 });
    await novaRotina.click({ timeout: 15_000 });
    marcarEtapaS170("abrir formulário de Rotina");
    const formulario = rotinas.getByRole("region", { name: "Nova Rotina" });
    await expect(formulario).toBeVisible({ timeout: 15_000 });
    marcarEtapaS170("preencher nome da Rotina");
    await formulario.getByLabel("Nome da Rotina").fill(nomeRotina, { timeout: 15_000 });
    marcarEtapaS170("selecionar tipo de alvo");
    await formulario.getByLabel("Tipo de alvo").selectOption("sistema", { timeout: 15_000 });
    marcarEtapaS170("selecionar alvo da Rotina");
    const seletorAlvo = formulario.getByLabel("Alvo da Rotina", { exact: true });
    try {
      await expect(seletorAlvo.locator('option:not([value=""])')).toHaveCount(1, {
        timeout: 30_000,
      });
      const alvos = await seletorAlvo.locator("option").evaluateAll((opcoes) =>
        opcoes
          .map((opcao) => ({
            id: (opcao as HTMLOptionElement).value,
            nome: opcao.textContent?.trim(),
          }))
          .filter((opcao) => opcao.id !== ""),
      );
      expect(alvos).toHaveLength(1);
      expect(alvos[0]?.nome).toBe("Sistema sintético");
      const alvoId = alvos[0]?.id;
      if (!alvoId) throw new Error("Opção sintética sem identificador.");
      await seletorAlvo.selectOption(alvoId, { timeout: 15_000 });
      await expect(seletorAlvo).toHaveValue(alvoId);
    } catch (erro) {
      const causaSelecao = (erro instanceof Error ? erro.message : String(erro))
        .split(/\r?\n/, 1)[0]
        .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "<id>")
        .slice(0, 120);
      const estadoAlvo = await operador.evaluate(() => {
        const secao = document.querySelector('section[aria-label="Nova Rotina"]');
        const rotulo = Array.from(secao?.querySelectorAll("label") ?? []).find((item) =>
          item.textContent?.trim().startsWith("Alvo da Rotina"),
        );
        const select = rotulo?.querySelector("select");
        return {
          formularioVisivel: Boolean(secao),
          seletor: select
            ? {
                desabilitado: select.disabled,
                desabilitadoNativo: select.matches(":disabled"),
                ariaDesabilitado: select.getAttribute("aria-disabled") === "true",
                quantidadeOpcoes: select.options.length,
              }
            : null,
          alertaPresente: Boolean(secao?.querySelector('[role="alert"]')),
        };
      });
      marcarDiagnosticoS170(
        "s170-rpc",
        `ALVOS=${respostasAlvo.slice(-4).join(",")}; UI=${JSON.stringify(estadoAlvo)}`,
      );
      throw new Error(`S170_TARGET_SELECT_FAILED:${causaSelecao}`);
    }
    marcarEtapaS170("selecionar modo de recorrência");
    await formulario.getByLabel("Modo").selectOption("calendario", { timeout: 15_000 });
    marcarEtapaS170("preencher intervalo");
    await formulario.getByLabel("Intervalo").fill("1", { timeout: 15_000 });
    marcarEtapaS170("selecionar unidade de recorrência");
    await formulario
      .getByLabel("Unidade da recorrência")
      .selectOption("meses", { timeout: 15_000 });
    marcarEtapaS170("preencher data-base");
    await formulario
      .getByLabel("Data-base")
      .fill(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10), { timeout: 15_000 });
    marcarEtapaS170("preencher tempo estimado");
    await formulario.getByLabel("Tempo estimado em minutos").fill("15", { timeout: 15_000 });
    marcarEtapaS170("selecionar referência do tempo");
    await formulario.getByLabel("Referência do tempo").selectOption("total", { timeout: 15_000 });
    marcarEtapaS170("preencher instrução da Rotina");
    await formulario
      .getByLabel("Instrução")
      .fill("Inspecionar o Sistema sintético.", { timeout: 15_000 });
    marcarEtapaS170("salvar Rotina");
    await formulario.getByRole("button", { name: "Salvar Rotina" }).click();
    await expect(rotinas.getByRole("listitem").filter({ hasText: nomeRotina })).toBeVisible();

    const itemPlano = planos.getByRole("listitem").filter({ hasText: nomePlano });
    marcarEtapaS170("enviar Plano para revisão");
    await itemPlano.getByRole("button", { name: `Enviar ${nomePlano} para revisão` }).click();
    await itemPlano.getByRole("button", { name: "Confirmar envio para revisão" }).click();
    await expect(itemPlano).toContainText("em_revisao");
    marcarEtapaS170("aprovar Plano");
    await itemPlano.getByRole("button", { name: `Aprovar ${nomePlano}` }).click();
    await itemPlano.getByLabel("Início da vigência").fill(new Date().toISOString().slice(0, 10));
    await itemPlano.getByRole("button", { name: "Confirmar aprovação" }).click();
    await expect(itemPlano).toContainText("aprovado");

    marcarEtapaS170("revogar concessão administrativa");
    await administrador.getByLabel("Motivo da alteração").fill("Revogação sintética S170");
    const concessoes = administrador.getByRole("heading", { name: "Concessões" }).locator("..");
    const concessao = concessoes.getByText(/Gerir Plano de Manutenção/).locator("..");
    await concessao.getByRole("button", { name: "Revogar" }).click();
    await expect(administrador.getByText("Alteração registrada.")).toBeVisible();

    marcarEtapaS170("verificar revogação na sessão do operador");
    await operador.getByRole("button", { name: "Estrutura" }).click();
    await operador.getByRole("button", { name: "Preventivas" }).click();
    await expect(
      operador.getByText("Você está sem permissão para gerir o calendário deste Cliente."),
    ).toBeVisible();
    await expect(
      operador.getByText("Você está sem permissão para gerir Planos deste Cliente."),
    ).toBeVisible();
  } finally {
    await Promise.all([administrador.close(), operador.close()]);
  }
});
