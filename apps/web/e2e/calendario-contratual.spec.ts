import { type Page, expect, test } from "@playwright/test";

const cfg = {
  app: process.env.SSO_S166_APP_URL,
  api: process.env.SSO_S166_SUPABASE_URL,
  anon: process.env.SSO_S166_ANON_KEY,
  emailA: process.env.SSO_S166_EMAIL_A,
  senhaA: process.env.SSO_S166_SENHA_A,
  emailB: process.env.SSO_S166_EMAIL_B,
  senhaB: process.env.SSO_S166_SENHA_B,
  clienteA: process.env.SSO_S166_CLIENTE_A,
  clienteB: process.env.SSO_S166_CLIENTE_B,
  contrato: process.env.SSO_S166_CONTRATO_ID,
  diaNovo: process.env.SSO_S166_DIA_NOVO,
  vigencia: process.env.SSO_S166_VIGENCIA,
};

function origemLoopback(valor: string | undefined): URL {
  if (!valor) throw new Error("Fixture E2E S166 incompleta.");
  const url = new URL(valor);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "::1"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("E2E S166 exige serviços HTTP sintéticos em loopback.");
  return url;
}

const app = origemLoopback(cfg.app);
const api = origemLoopback(cfg.api);
if (
  process.env.SSO_S166_E2E_ISOLADO !== "true" ||
  cfg.api !== process.env.VITE_SUPABASE_URL ||
  !cfg.anon ||
  !cfg.emailA ||
  !cfg.senhaA ||
  !cfg.emailB ||
  !cfg.senhaB ||
  !cfg.clienteA ||
  !cfg.clienteB ||
  !cfg.contrato ||
  !cfg.diaNovo ||
  !cfg.vigencia
)
  throw new Error("Fixture E2E S166 incompleta ou URL Supabase diferente da app.");
if (
  cfg.diaNovo !== "1" &&
  cfg.diaNovo !== "2" &&
  cfg.diaNovo !== "3" &&
  cfg.diaNovo !== "4" &&
  cfg.diaNovo !== "5" &&
  cfg.diaNovo !== "6" &&
  cfg.diaNovo !== "7"
)
  throw new Error("SSO_S166_DIA_NOVO deve estar entre 1 e 7.");

async function restringirRede(page: Page) {
  await page.routeWebSocket("**/*", (socket) => socket.close());
  await page.route("**/*", async (route) => {
    const destino = new URL(route.request().url());
    if (destino.protocol !== "http:" || ![app.origin, api.origin].includes(destino.origin)) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
}

async function entrar(page: Page, email: string, senha: string) {
  await page.goto(new URL("/login", app).href);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).first().click();
}

async function abrirPreventivas(page: Page, cliente: string) {
  await page.getByText(cliente, { exact: true }).first().click();
  await page
    .getByRole("region", { name: "Operação" })
    .getByRole("button", { name: "Preventivas", exact: true })
    .click();
}

function exigir(valor: string | undefined, nome: string): string {
  if (!valor) throw new Error(`Fixture E2E S166 sem ${nome}.`);
  return valor;
}

test.use({ storageState: { cookies: [], origins: [] } });
function marcarDiagnostico(tipo: string, descricao: string) {
  const marcacao = test.info().annotations.find((item) => item.type === tipo);
  if (marcacao) marcacao.description = descricao;
  else test.info().annotations.push({ type: tipo, description: descricao });
}
const marcarEtapa = (etapa: string) => marcarDiagnostico("s166-etapa", etapa);

test("revisa e confirma fotografia completa de 501 Visitas no clone sintético", async ({
  page,
}) => {
  test.setTimeout(120_000);
  marcarEtapa("restringir rede");
  await restringirRede(page);
  marcarEtapa("entrar e abrir Cliente");
  await entrar(
    page,
    exigir(cfg.emailA, "SSO_S166_EMAIL_A"),
    exigir(cfg.senhaA, "SSO_S166_SENHA_A"),
  );
  let regrasDiagnostico = "sem-resposta";
  page.on("response", async (response) => {
    if (!new URL(response.url()).pathname.endsWith("/rpc/sso_listar_regras_calendario")) return;
    if (!response.ok()) {
      regrasDiagnostico = `${response.status()}:erro`;
      return;
    }
    try {
      const linhas = await response.json();
      regrasDiagnostico = `${response.status()}:linhas=${Array.isArray(linhas) ? linhas.length : "formato-invalido"}:contrato=${Array.isArray(linhas) && linhas.some((linha) => linha.contrato_id === cfg.contrato)}`;
    } catch {
      regrasDiagnostico = `${response.status()}:corpo-invalido`;
    }
  });
  await abrirPreventivas(page, exigir(cfg.clienteA, "SSO_S166_CLIENTE_A"));

  marcarEtapa("abrir Calendário contratual");
  const calendario = page.getByRole("region", { name: "Calendário contratual" });
  await expect(calendario).toBeVisible();
  const regra = calendario
    .getByRole("listitem")
    .filter({ hasText: `Contrato ${cfg.contrato}` })
    .first();
  try {
    await expect(regra).toContainText(/versão \d+/, { timeout: 15_000 });
  } catch {
    const estado = (await calendario.innerText().catch(() => "sem-texto"))
      .replace(/\s+/g, " ")
      .slice(0, 240);
    throw new Error(`S166_REGRA_CALENDARIO=${estado}; RPC=${regrasDiagnostico}`);
  }
  await regra.getByLabel("Novo dia").first().selectOption(exigir(cfg.diaNovo, "SSO_S166_DIA_NOVO"));
  await regra.getByLabel("Vigência").first().fill(exigir(cfg.vigencia, "SSO_S166_VIGENCIA"));
  const lote = regra.getByRole("region", { name: "Alteração de dia contratual em lote" });
  const respostasFotografia: string[] = [];
  page.on("response", async (response) => {
    const endpoint = new URL(response.url()).pathname.split("/").pop() ?? "";
    if (
      !new Set([
        "sso_iniciar_mudanca_dia_v2",
        "sso_pagina_mudanca_dia_v2",
        "sso_selar_mudanca_dia_v2",
        "sso_confirmar_mudanca_dia_v2",
      ]).has(endpoint)
    )
      return;
    let codigo = "ok";
    try {
      const corpo = await response.json();
      if (!response.ok()) codigo = String(corpo?.code ?? "erro").slice(0, 24);
      if (endpoint === "sso_confirmar_mudanca_dia_v2") {
        codigo =
          `${codigo}:movidas=${corpo?.visitasMovidas ?? corpo?.visitas_movidas ?? "?"}`.slice(
            0,
            60,
          );
      }
    } catch {
      codigo = response.ok() ? "corpo-invalido" : "erro";
    }
    respostasFotografia.push(`${endpoint}:${response.status()}:${codigo}`);
    marcarDiagnostico("s166-rpc", respostasFotografia.slice(-6).join(","));
  });
  page.on("requestfailed", (request) => {
    const endpoint = new URL(request.url()).pathname.split("/").pop() ?? "";
    if (
      [
        "sso_iniciar_mudanca_dia_v2",
        "sso_pagina_mudanca_dia_v2",
        "sso_selar_mudanca_dia_v2",
        "sso_confirmar_mudanca_dia_v2",
      ].includes(endpoint)
    ) {
      respostasFotografia.push(`${endpoint}:falha-rede`);
      marcarDiagnostico("s166-rpc", respostasFotografia.slice(-6).join(","));
    }
  });
  marcarEtapa("iniciar fotografia");
  await lote
    .getByRole("button", { name: "Preparar fotografia completa das Visitas" })
    .click({ timeout: 10_000 });
  marcarEtapa("aguardar disponibilidade de Retomar fotografia");
  const retomar = lote.getByRole("button", { name: /Retomar fotografia/ });
  await expect(retomar).toBeVisible({ timeout: 15_000 });
  marcarEtapa("carregar primeira página da fotografia");
  await retomar.click({ timeout: 10_000 });

  let paginas = 0;
  while (paginas < 20) {
    marcarEtapa(`aguardar e revisar página ${paginas + 1}`);
    const estadoPagina = lote.getByText(/^Página \d+ ·/);
    await expect(estadoPagina).toBeVisible();
    const numero = Number((await estadoPagina.innerText()).match(/^Página (\d+)/)?.[1]);
    expect(Number.isInteger(numero) && numero > 0).toBe(true);
    await lote.getByLabel("Revisei os impactos desta página").check();
    const proxima = lote.getByRole("button", { name: "Próxima página", exact: true });
    if (await proxima.count()) {
      await proxima.click();
      await expect(estadoPagina).toContainText(`Página ${numero + 1} ·`);
      paginas += 1;
      continue;
    }
    break;
  }
  expect(paginas).toBeGreaterThan(0);
  marcarEtapa("selar fotografia completa");
  await expect(lote.getByRole("button", { name: /Selar fotografia completa/ })).toBeVisible();
  await lote.getByRole("button", { name: /Selar fotografia completa/ }).click();
  await expect(lote.getByText(/Fotografia completa selada · 501 Visitas/)).toBeVisible();
  await lote.getByLabel("Conferi todas as páginas e autorizo esta alteração atômica").check();
  marcarEtapa("confirmar movimentação das 501 Visitas");
  await lote.getByRole("button", { name: "Confirmar alteração de 501 Visitas" }).click();
  try {
    await expect(lote.getByText(/Concluído: 501 movidas/)).toBeVisible({ timeout: 15_000 });
  } catch {
    const estado = (await lote.innerText().catch(() => "sem-texto"))
      .replace(/\s+/g, " ")
      .slice(0, 320);
    throw new Error(`S166_CONFIRM=${estado}; RPC=${respostasFotografia.slice(-6).join(",")}`);
  }
});

test("nega calendário no segundo Cliente sem iniciar uma fotografia", async ({ page }) => {
  await restringirRede(page);
  let iniciou = false;
  page.on("request", (request) => {
    if (request.url().includes("sso_iniciar_mudanca_dia_v2")) iniciou = true;
  });
  await entrar(
    page,
    exigir(cfg.emailB, "SSO_S166_EMAIL_B"),
    exigir(cfg.senhaB, "SSO_S166_SENHA_B"),
  );
  await abrirPreventivas(page, exigir(cfg.clienteB, "SSO_S166_CLIENTE_B"));
  await expect(
    page.getByText("Você está sem permissão para gerir o calendário deste Cliente."),
  ).toBeVisible();
  expect(iniciou).toBe(false);
});
