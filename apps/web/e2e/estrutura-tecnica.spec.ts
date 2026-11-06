import { type Page, expect, test } from "@playwright/test";

// E01-S176 US1/US2. Requer configuração isolada: cria Grupo Quantitativo, cuja tabela
// não concede UPDATE para remoção lógica. O clone descartável é a limpeza final; não aciona Auvo.
let negarLeituraEstrutura = false;

test.afterEach(async () => {
  // Todos os dados são removidos com o clone; nenhum PATCH de limpeza é enviado.
  negarLeituraEstrutura = false;
});

async function criarCliente(page: Page, nome: string) {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).click();
  await page.getByRole("button", { name: "Novo cliente" }).click();
  await page.getByLabel("Nome *").fill(nome);
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByPlaceholder("Buscar por cliente, cidade, contato, CNPJ ou ID Auvo").fill(nome);
  await expect(page.getByText(nome, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.getByText(nome, { exact: true }).first().click();
}

test("cadastra um Grupo Quantitativo por Local e mantém a lista isolada por Cliente", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const marcarEtapa = (etapa: string) => console.log(`S176_ETAPA=${etapa}`);
  const appUrl = new URL(process.env.SSO_S176_APP_URL ?? "");
  const backendUrl = new URL(process.env.SSO_S176_SUPABASE_URL ?? "");
  const origensPermitidas = new Set([appUrl.origin, backendUrl.origin]);
  await page.routeWebSocket("**/*", (socket) => socket.close());
  await page.route("**/*", async (route) => {
    const destino = new URL(route.request().url());
    if (destino.protocol !== "http:" || !origensPermitidas.has(destino.origin)) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  if (!process.env.SSO_S176_EMAIL || !process.env.SSO_S176_SENHA)
    throw new Error("Fixture S176 ausente");
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.SSO_S176_EMAIL);
  await page.getByLabel("Senha").fill(process.env.SSO_S176_SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  marcarEtapa("sessão iniciada");
  const sufixo = Date.now();
  const nomeArea = `Torre S176 ${sufixo}`;
  const nomeLocal = `Salão S176 ${sufixo}`;
  const clienteA = `[TESTE E2E] S176 Cliente A ${sufixo}`;
  const clienteB = `[TESTE E2E] S176 Cliente B ${sufixo}`;
  const nomeGrupo = `[TESTE E2E] 20 luminárias ${sufixo}`;
  const falhasApi: string[] = [];
  const respostasPermissao: string[] = [];
  let areaCriada: { id: string; cliente_id: string; nome: string } | null = null;
  let consultaArea = "sem-consulta";
  const endpointsEstrutura = new Set([
    "areas",
    "locais",
    "local_tipos",
    "equipamentos",
    "clientes",
    "sistemas",
    "sistema_itens",
    "equipamento_categorias",
    "grupos_quantitativos",
  ]);
  page.on("response", async (response) => {
    const url = new URL(response.url());
    const relacao = url.pathname.split("/").pop() ?? "";
    if (relacao === "sso_autorizar_acao") {
      try {
        const acao = JSON.parse(response.request().postData() ?? "{}").p_acao;
        respostasPermissao.push(`${acao}:${response.status()}:${await response.text()}`);
      } catch {
        respostasPermissao.push(`sso_autorizar_acao:${response.status()}:resposta-invalida`);
      }
    }
    if (relacao === "areas" && response.request().method() === "POST" && response.ok()) {
      try {
        const corpo = await response.json();
        const linha = Array.isArray(corpo) ? corpo[0] : corpo;
        if (
          typeof linha?.id === "string" &&
          typeof linha?.cliente_id === "string" &&
          typeof linha?.nome === "string"
        )
          areaCriada = { id: linha.id, cliente_id: linha.cliente_id, nome: linha.nome };
      } catch {
        /* status é registrado separadamente */
      }
    }
    if (relacao === "areas" && response.request().method() === "GET" && areaCriada) {
      const idArea = areaCriada.id;
      const clienteDaArea = areaCriada.cliente_id;
      const nomeDaArea = areaCriada.nome;
      try {
        const corpo = await response.json();
        const linhas = Array.isArray(corpo) ? corpo : [];
        consultaArea = `${response.status()}:filtro=${url.searchParams.get("cliente_id") === `eq.${clienteDaArea}`}:nome=${linhas.some((linha) => linha.id === idArea && linha.nome === nomeDaArea)}:presente=${linhas.some((linha) => linha.id === idArea)}`;
      } catch {
        consultaArea = `${response.status()}:corpo-invalido`;
      }
    }
    if (
      !url.pathname.startsWith("/rest/v1/") ||
      !endpointsEstrutura.has(relacao) ||
      response.status() < 400
    )
      return;
    let codigo = "erro";
    try {
      codigo = String(JSON.parse(await response.text())?.code ?? "erro").slice(0, 24);
    } catch {
      /* só status */
    }
    falhasApi.push(`${response.request().method()}:${relacao}:${response.status()}:${codigo}`);
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    const relacao = url.pathname.split("/").pop() ?? "";
    if (url.pathname.startsWith("/rest/v1/") && endpointsEstrutura.has(relacao))
      falhasApi.push(`${request.method()}:${relacao}:falha-rede`);
  });
  // A etapa negativa abaixo prova a reação da interface à permissão negada.
  // A autorização no banco deve continuar coberta por pgTAP com JWT/RLS reais.
  await page.route("**/rest/v1/rpc/sso_autorizar_acao", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if (negarLeituraEstrutura && ["cadastro.ler", "cadastro.gerir"].includes(body.p_acao)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: "false" });
      return;
    }
    await route.continue();
  });

  marcarEtapa("criar cliente B");
  await criarCliente(page, clienteB);
  marcarEtapa("criar cliente A");
  await criarCliente(page, clienteA);

  marcarEtapa("criar área");
  await page.getByRole("button", { name: "Estrutura", exact: true }).click();
  await page.getByRole("button", { name: "Nova Área" }).click();
  await page.getByLabel("Nome *").fill(nomeArea);
  let respostaArea = "sem-resposta";
  page.on("response", async (response) => {
    const url = new URL(response.url());
    if (response.request().method() !== "POST" || url.pathname !== "/rest/v1/areas") return;
    let codigo = "ok";
    try {
      codigo = String(JSON.parse(await response.text())?.code ?? "ok").slice(0, 24);
    } catch {
      /* só status */
    }
    respostaArea = `${response.status()}:${codigo}`;
  });
  await page.getByRole("button", { name: "Salvar" }).click();
  try {
    await expect(page.locator("body")).toContainText(nomeArea, { timeout: 10_000 });
    await expect(page.getByLabel("Filtrar estrutura por área")).toContainText(nomeArea);
  } catch {
    const erroCarregar = await page
      .getByText("Não foi possível carregar a estrutura do cliente.", { exact: true })
      .isVisible()
      .catch(() => false);
    const areaNoTexto = (
      await page
        .locator("body")
        .innerText()
        .catch(() => "")
    ).includes(nomeArea);
    const tituloVisivel = await page
      .getByRole("heading", { name: "Estrutura do cliente" })
      .isVisible()
      .catch(() => false);
    const opcaoArea = await page
      .getByLabel("Filtrar estrutura por área")
      .locator("option")
      .allTextContents()
      .catch(() => []);
    throw new Error(
      `POST_AREAS=${respostaArea}; GET_AREAS=${consultaArea}; TEXTO=${areaNoTexto}; OPCAO=${opcaoArea.includes(nomeArea)}; TITULO=${tituloVisivel}; ERRO_CARREGAR=${erroCarregar}; ESTRUTURA_API=${falhasApi.join(",") || "sem-falhas-http"}`,
    );
  }
  await page.getByRole("button", { name: "Local", exact: true }).click();
  marcarEtapa("criar local");
  await page.getByLabel("Nome *").fill(nomeLocal);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(nomeLocal, { exact: true })).toBeVisible({ timeout: 10_000 });

  const grupos = page.getByRole("region", { name: "Grupos Quantitativos" });
  marcarEtapa("criar grupo quantitativo");
  const novoGrupo = grupos.getByRole("button", { name: "Novo grupo" });
  try {
    await expect(novoGrupo).toBeVisible({ timeout: 5_000 });
  } catch {
    const texto = (await grupos.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
    throw new Error(
      `S176_NOVO_GRUPO=${texto}; AUTORIZAÇÃO=${respostasPermissao.slice(-6).join(",") || "sem-resposta"}`,
    );
  }
  await novoGrupo.click({ timeout: 5_000 });
  marcarEtapa("formulário de grupo aberto");
  const nomeDoGrupo = grupos.getByLabel("Nome do grupo");
  try {
    await expect(nomeDoGrupo).toBeVisible({ timeout: 5_000 });
  } catch {
    const texto = (await grupos.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
    throw new Error(
      `S176_FORMULARIO_GRUPO=${texto}; API=${falhasApi.slice(-8).join(",") || "sem-falhas-http"}; AUTORIZAÇÃO=${respostasPermissao.slice(-6).join(",") || "sem-resposta"}`,
    );
  }
  marcarEtapa("preencher nome do grupo");
  await nomeDoGrupo.fill(nomeGrupo, { timeout: 5_000 });
  marcarEtapa("preencher quantidade do grupo");
  await grupos.getByLabel("Quantidade").fill("20", { timeout: 5_000 });
  marcarEtapa("selecionar Local do grupo");
  const seletorLocal = grupos.getByLabel("Local");
  try {
    await expect(seletorLocal).toBeEnabled({ timeout: 15_000 });
  } catch {
    const texto = (await grupos.innerText().catch(() => "sem-texto"))
      .replace(/\s+/g, " ")
      .slice(0, 360);
    const estado = await seletorLocal
      .evaluate((elemento) => {
        const select = elemento as HTMLSelectElement;
        return `disabled=${select.disabled};fieldset=${select.closest("fieldset")?.disabled ?? false};visible=${Boolean(select.getClientRects().length)}`;
      })
      .catch(() => "estado=indisponivel");
    const [selects, locaisDisponiveis] = await Promise.all([
      seletorLocal.count().catch(() => 0),
      seletorLocal
        .locator("option")
        .allTextContents()
        .catch(() => []),
    ]);
    throw new Error(
      `S176_LOCAL_SELECTS=${selects}; ${estado}; OPTIONS=${locaisDisponiveis.join("|")}; AUTORIZAÇÃO=${respostasPermissao.slice(-6).join(",")}; REGIÃO=${texto}`,
    );
  }
  const valorLocal = await seletorLocal.locator("option").evaluateAll((opcoes, nome) => {
    const opcao = opcoes.find((elemento) => {
      const texto = elemento.textContent?.trim() ?? "";
      return texto === nome || texto.endsWith(`/ ${nome}`);
    });
    return opcao?.getAttribute("value") ?? null;
  }, nomeLocal);
  if (!valorLocal) {
    throw new Error(
      `S176_LOCAL_OPTION_AUSENTE=${nomeLocal}; OPTIONS=${(await seletorLocal.locator("option").allTextContents().catch(() => [])).join("|")}`,
    );
  }
  try {
    await seletorLocal.selectOption(valorLocal, { timeout: 5_000 });
  } catch {
    const estado = await seletorLocal
      .evaluate((elemento) => {
        const select = elemento as HTMLSelectElement;
        return `disabled=${select.disabled};fieldset=${select.closest("fieldset")?.disabled ?? false};value=${select.value};visible=${Boolean(select.getClientRects().length)}`;
      })
      .catch(() => "estado=indisponivel");
    throw new Error(
      `S176_LOCAL_SELECAO_FALHOU=${estado}; OPTIONS=${(await seletorLocal.locator("option").allTextContents().catch(() => [])).join("|")}; AUTORIZAÇÃO=${respostasPermissao.slice(-6).join(",")}`,
    );
  }
  marcarEtapa("carregar categorias do grupo");
  const categoria = grupos.getByLabel("Categoria");
  try {
    await expect
      .poll(async () => categoria.locator('option:not([value=""])').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
  } catch {
    const texto = (await grupos.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 280);
    throw new Error(
      `S176_CATEGORIAS=${texto}; API=${falhasApi.slice(-8).join(",") || "sem-falhas-http"}`,
    );
  }
  const categoriaId = await categoria
    .locator('option:not([value=""])')
    .first()
    .getAttribute("value");
  if (!categoriaId) throw new Error("A fixture não encontrou uma Categoria ativa para o Grupo.");
  await categoria.selectOption(categoriaId);
  const salvarGrupo = grupos.getByRole("button", { name: "Salvar grupo" });
  await expect(salvarGrupo).toBeEnabled({ timeout: 15_000 });
  await salvarGrupo.click();
  marcarEtapa("salvar grupo");
  await expect(grupos.getByText(`${nomeGrupo} — 20 unidades`, { exact: false })).toBeVisible({
    timeout: 10_000,
  });

  // O grupo permanece como uma entidade com quantidade, não se desdobra em 20 Componentes.
  await expect(grupos.getByText(nomeGrupo, { exact: false })).toHaveCount(1);
  const distribuidos = page.getByRole("region", { name: "Sistemas distribuídos" });
  await expect(distribuidos.getByText(/Locais derivados de vínculos/)).toBeVisible();
  const planosDoGrupo = grupos.getByRole("button", { name: "Ver Planos deste ativo" });
  await expect(planosDoGrupo).toBeVisible();
  await planosDoGrupo.click();
  await expect(grupos.getByText("Nenhum vínculo encontrado nesta fonte.")).toBeVisible();
  await page.getByText("Clientes", { exact: true }).click();
  await page
    .getByPlaceholder("Buscar por cliente, cidade, contato, CNPJ ou ID Auvo")
    .fill(clienteB);
  await expect(page.getByText(clienteB, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.getByText(clienteB, { exact: true }).first().click();
  marcarEtapa("validar isolamento entre clientes");
  negarLeituraEstrutura = true;
  await page.getByRole("button", { name: "Estrutura", exact: true }).click();
  await expect(page.getByRole("region", { name: "Grupos Quantitativos" })).toHaveCount(0);
  await expect(page.getByText(nomeGrupo, { exact: false })).toHaveCount(0);
});
