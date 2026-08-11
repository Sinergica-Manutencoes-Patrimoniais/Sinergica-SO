import { expect, test } from "@playwright/test";

// E01-S118 T7: Chamados foi unificado no board da Operação (menu "Chamados" → OrdensServicoPage).
// Um Chamado recém-criado ainda não tem OS — aparece como card sintético (coluna Solicitação/
// linha da Lista) até "Gerar OS"/"Enviar ao backlog". O painel de detalhe mostra o `ChamadoPainel`
// (histórico/datas/ações) sempre que há `chamadoId` — inclusive depois de já ter virado OS
// (requisito explícito do Lucas: histórico nunca some).
async function abrirBoard(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByTitle("Chamados", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Operação" })).toBeVisible({ timeout: 15_000 });
}

function linhaDoTitulo(page: import("@playwright/test").Page, titulo: string) {
  // `titulo` tem `[`/`]` (marcador "[TESTE E2E]") — usa string crua (substring, case-insensitive),
  // não RegExp, senão os colchetes viram metacaracteres de regex.
  return page.getByRole("row", { name: titulo });
}

test("E01-S145: abre em Ativos com duas consultas críticas e pagina sem repetição", async ({
  page,
}, testInfo) => {
  const consultasCriticas: string[] = [];
  const respostasCriticas: Array<{ url: string; duracaoMs: number; payloadBytes: number }> = [];
  await page.addInitScript(() => {
    const janela = window as unknown as { __chamadosLongTasks: number[] };
    janela.__chamadosLongTasks = [];
    new PerformanceObserver((lista) => {
      janela.__chamadosLongTasks.push(...lista.getEntries().map((entrada) => entrada.duration));
    }).observe({ type: "longtask", buffered: true });
  });
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/rest/v1/operacao_itens") || url.includes("/rpc/fn_kpis_operacao")) {
      consultasCriticas.push(url);
    }
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("/rest/v1/operacao_itens") || url.includes("/rpc/fn_kpis_operacao")) {
      respostasCriticas.push({
        url,
        duracaoMs: response.request().timing().responseEnd,
        payloadBytes: (await response.body()).byteLength,
      });
    }
  });

  await abrirBoard(page);
  const filtroStatus = page
    .locator("select")
    .filter({ has: page.locator('option[value="ativos"]') });
  await expect(filtroStatus).toHaveValue("ativos");
  await expect.poll(() => consultasCriticas.length).toBe(2);
  await expect.poll(() => respostasCriticas.length).toBe(2);
  await page.waitForFunction(
    () => performance.getEntriesByName("chamados:content-painted").length === 1,
  );

  const marcas = await page.evaluate(() =>
    ["chamados:navigation-start", "chamados:data-ready", "chamados:content-painted"].map(
      (nome) => performance.getEntriesByName(nome).length,
    ),
  );
  expect(marcas).toEqual([1, 1, 1]);
  const longTasks = await page.evaluate(
    () => (window as unknown as { __chamadosLongTasks: number[] }).__chamadosLongTasks,
  );
  await testInfo.attach("chamados-long-tasks.json", {
    body: JSON.stringify(longTasks),
    contentType: "application/json",
  });
  await testInfo.attach("chamados-respostas-criticas.json", {
    body: JSON.stringify(respostasCriticas),
    contentType: "application/json",
  });

  const carregarMais = page.getByRole("button", { name: "Carregar mais" });
  if (await carregarMais.isVisible()) {
    const linhasAntes = await page.getByRole("row").allTextContents();
    await carregarMais.click();
    await expect(carregarMais).toBeEnabled({ timeout: 10_000 });
    const linhasDepois = await page.getByRole("row").allTextContents();
    expect(linhasDepois.length).toBeGreaterThan(linhasAntes.length);
    expect(new Set(linhasDepois).size).toBe(linhasDepois.length);
  }
});

// E01-S88 AC-1/AC-2/AC-3/AC-5 + E01-S118: cria um Chamado (aparece como card sem OS ainda), gera
// uma OS a partir dele e confirma que o histórico do Chamado continua acessível.
test("cria Chamado, gera OS a partir dele e o histórico continua acessível", async ({ page }) => {
  const sufixo = Date.now();
  const tituloChamado = `[TESTE E2E] Chamado ${sufixo}`;

  await abrirBoard(page);

  await page.getByRole("button", { name: "Novo Chamado" }).click();
  await expect(page.getByRole("heading", { name: "Novo Chamado" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByLabel("Título *").fill(tituloChamado);
  await page.getByRole("button", { name: "Criar Chamado" }).click();
  await expect(page.getByRole("heading", { name: "Novo Chamado" })).not.toBeVisible({
    timeout: 10_000,
  });

  // AC-1: numeração CH-XXXX já no card, mesmo sem OS ainda.
  const linha = linhaDoTitulo(page, tituloChamado);
  await expect(linha).toBeVisible({ timeout: 10_000 });
  await expect(linha.getByText(/^CH-\d{4}$/)).toBeVisible();

  await linha.click();
  await expect(page.getByText("Resumo do Chamado", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole("button", { name: "Gerar OS" })).toBeVisible();

  // AC-3: gera OS a partir do Chamado — tipo de tarefa já vem pré-selecionado.
  await page.getByRole("button", { name: "Gerar OS" }).click();
  await expect(page.getByRole("heading", { name: "Gerar OS" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Confirmar" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByRole("heading", { name: "Gerar OS" })).not.toBeVisible({
    timeout: 10_000,
  });

  // Reabre o item (agora é uma OS real, mesmo CH-XXXX) e confirma: o painel vira "Resumo da OS",
  // mas o histórico do Chamado (ChamadoPainel) continua visível — só as ações somem.
  const linhaDepoisDeOs = linhaDoTitulo(page, tituloChamado);
  await expect(linhaDepoisDeOs).toBeVisible({ timeout: 10_000 });
  await linhaDepoisDeOs.click();
  await expect(page.getByText("Resumo da OS", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Convertido em OS", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gerar OS" })).not.toBeVisible();
});

// E01-S88 AC-4: cancelamento exige justificativa (bloqueia sem ela) e aceita anexo opcional.
test("cancela um Chamado com justificativa e anexo", async ({ page }) => {
  const sufixo = Date.now();
  const tituloChamado = `[TESTE E2E] Chamado cancelar ${sufixo}`;

  await abrirBoard(page);

  await page.getByRole("button", { name: "Novo Chamado" }).click();
  await page.getByLabel("Título *").fill(tituloChamado);
  await page.getByRole("button", { name: "Criar Chamado" }).click();

  const linha = linhaDoTitulo(page, tituloChamado);
  await expect(linha).toBeVisible({ timeout: 10_000 });
  await linha.click();
  await expect(page.getByRole("button", { name: "Cancelar Chamado" })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "Cancelar Chamado" }).click();
  await expect(page.getByRole("heading", { name: "Cancelar Chamado" })).toBeVisible({
    timeout: 10_000,
  });

  // AC-4: sem justificativa, o botão de confirmar fica desabilitado (nunca cancela sem motivo).
  await expect(page.getByRole("button", { name: "Confirmar cancelamento" })).toBeDisabled();

  await page.getByLabel("Justificativa *").fill("Cliente desistiu (teste E01-S88)");
  await page.setInputFiles('input[type="file"]', {
    name: "print-whatsapp.png",
    mimeType: "image/png",
    buffer: Buffer.from("teste e2e anexo de cancelamento"),
  });
  await page.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(page.getByRole("heading", { name: "Cancelar Chamado" })).not.toBeVisible({
    timeout: 10_000,
  });

  // Chamado cancelado não fica mais em `status=aberto` — some do board (não é mais um card
  // "sem OS ainda" ativo). Reabrir o board confirma que a linha não existe mais.
  await expect(linhaDoTitulo(page, tituloChamado)).not.toBeVisible({ timeout: 10_000 });
});

// E01-S94: "Enviar ao backlog" exige Gravidade/Urgência/Tendência preenchidas — sem escolha real
// do usuário, o item cai no Backlog GUT sempre com o mesmo score (bug anterior: 3/3/3 hardcoded).
test("bloqueia 'Enviar ao backlog' sem GUT completo e libera após preencher", async ({ page }) => {
  const sufixo = Date.now();
  const tituloChamado = `[TESTE E2E] Chamado backlog GUT ${sufixo}`;

  await abrirBoard(page);

  await page.getByRole("button", { name: "Novo Chamado" }).click();
  await page.getByLabel("Título *").fill(tituloChamado);
  await page.getByRole("button", { name: "Criar Chamado" }).click();

  const linha = linhaDoTitulo(page, tituloChamado);
  await expect(linha).toBeVisible({ timeout: 10_000 });
  await linha.click();
  await expect(page.getByRole("button", { name: "Enviar ao backlog" })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "Enviar ao backlog" }).click();
  await expect(page.getByRole("heading", { name: "Enviar ao backlog" })).toBeVisible({
    timeout: 10_000,
  });

  // AC-2: sem GUT completo, "Confirmar" fica desabilitado (tipo de tarefa já vem pré-selecionado).
  await expect(page.getByRole("button", { name: "Confirmar" })).toBeDisabled();

  // AC-1: os 3 seletores aparecem no modo backlog.
  await page.getByLabel("Gravidade *").selectOption("4");
  await expect(page.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  await page.getByLabel("Urgência *").selectOption("3");
  await expect(page.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  await page.getByLabel("Tendência *").selectOption("5");

  await expect(page.getByRole("button", { name: "Confirmar" })).toBeEnabled({ timeout: 5_000 });
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByRole("heading", { name: "Enviar ao backlog" })).not.toBeVisible({
    timeout: 10_000,
  });

  // Reabre — vira OS real (status "backlog"), e o histórico do Chamado continua acessível.
  const linhaDepoisDoBacklog = linhaDoTitulo(page, tituloChamado);
  await expect(linhaDepoisDoBacklog).toBeVisible({ timeout: 10_000 });
  await linhaDepoisDoBacklog.click();
  await expect(page.getByText("Resumo da OS", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Enviado ao backlog", { exact: true })).toBeVisible();
});
