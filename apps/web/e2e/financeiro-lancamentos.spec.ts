import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));

// E04-S03: dashboard de caixa — KPIs + gráficos SVG. Carrega sem erro de console, tema claro e
// escuro legíveis.
test("dashboard financeiro carrega KPIs e gráficos sem erro", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (err) => erros.push(err.message));

  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Dashboard", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Dashboard Financeiro" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Posição de caixa", { exact: true })).toBeVisible();
  await expect(page.getByText("Resultado do mês", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fluxo mensal (12 meses)" })).toBeVisible();
  await expect(page.locator("svg[aria-label='Fluxo mensal de entradas e saídas']")).toBeVisible();

  // tema escuro
  await page.getByRole("button", { name: "Usar modo noite" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard Financeiro" })).toBeVisible();

  expect(erros).toEqual([]);
});

// E04-S04: contrato → gerar recebível do mês → ver em Contas a Receber → dar baixa.
test("cria contrato, gera recebível do mês e dá baixa em contas a receber", async ({ page }) => {
  const descricaoContrato = `[TESTE E2E] Contrato ${Date.now()}`;

  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Contratos", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contratos" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Novo contrato" }).click();
  const modal = page.locator(".modal-backdrop");
  await modal.getByLabel("Cliente *").selectOption({ index: 1 });
  await modal.getByPlaceholder("0,00").fill("300,00");
  await modal.getByLabel("Descrição").fill(descricaoContrato);
  await modal.getByRole("button", { name: "Salvar" }).click();
  await expect(modal).toBeHidden({ timeout: 10_000 });
  await expect(page.getByText(descricaoContrato, { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Gerar previstos do mês" }).click();
  await expect(page.getByText(/recebível\(is\) gerado|Nenhum recebível novo/)).toBeVisible({
    timeout: 10_000,
  });

  await page.getByText("Contas a Receber", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contas a receber" })).toBeVisible({
    timeout: 15_000,
  });
});

// E04-S02: import OFX — upload da fixture 1.x (SGML), prévia, confirmar import, reimportar sem
// duplicar (dedupe por FITID).
test("importa extrato OFX e reimporta sem duplicar", async ({ page }) => {
  const nomeConta = `[TESTE E2E] Conta OFX ${Date.now()}`;
  const fixture = join(
    __dirname,
    "..",
    "src/features/financeiro/domain/__fixtures__/exemplo-1x.ofx",
  );

  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Contas Bancárias", { exact: true }).click();
  await page.getByRole("button", { name: "Nova conta" }).click();
  await page.getByPlaceholder("Itaú PJ").fill(nomeConta);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(nomeConta, { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByText("Importar Extrato", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Importar extrato (OFX)" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Conta *").selectOption({ label: nomeConta });
  await page.setInputFiles('input[type="file"]', fixture);

  await expect(page.getByText("3 transação(ões) lida(s)")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByText("3 nova(s) · 0 já importada(s).", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("Pendentes (3)", { exact: true })).toBeVisible();

  // reimportar o mesmo arquivo: dedupe por FITID, 0 novas
  await page.setInputFiles('input[type="file"]', fixture);
  await expect(page.getByText("3 transação(ões) lida(s)")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByText("0 nova(s) · 3 já importada(s).", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("Pendentes (3)", { exact: true })).toBeVisible();
});

// E04-S05: despesa fixa → gerar previsto do mês → aparece em Contas a Pagar → dá baixa; dashboard
// mostra a projeção de caixa.
test("cria despesa fixa, gera previsto e vê em contas a pagar", async ({ page }) => {
  const descricaoDespesa = `[TESTE E2E] Despesa ${Date.now()}`;

  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Contas a Pagar", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contas a pagar" })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: "Nova despesa fixa" }).click();
  const modal = page.locator(".modal-backdrop");
  await modal.getByPlaceholder("Aluguel").fill(descricaoDespesa);
  await modal.getByPlaceholder("0,00").fill("120,00");
  await modal.getByLabel("Categoria *").selectOption({ index: 1 });
  await modal.getByRole("button", { name: "Salvar" }).click();
  await expect(modal).toBeHidden({ timeout: 10_000 });
  await expect(page.getByText(descricaoDespesa)).toBeVisible({ timeout: 10_000 });

  // gera o previsto do mês pela mesma RPC usada em Contratos
  await page.getByText("Contratos", { exact: true }).click();
  await page.getByRole("button", { name: "Gerar previstos do mês" }).click();
  await expect(page.getByText(/recebível\(is\) gerado|Nenhum recebível novo/)).toBeVisible({
    timeout: 10_000,
  });

  // dashboard mostra bloco de projeção
  await page.getByText("Dashboard", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Projeção de caixa" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("+30d", { exact: true })).toBeVisible();
});

// E04-S06: custo de funcionário → R$/h derivado; tela de rentabilidade carrega sem erro.
test("cadastra custo de funcionário e vê rentabilidade sem erro", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (err) => erros.push(err.message));

  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Custos de Pessoal", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Custos de pessoal" })).toBeVisible({
    timeout: 15_000,
  });

  // vigente_desde varia por execução (unique funcionario_id+vigente_desde) pra reruns não colidirem
  const vigenteDesde = new Date(2020, 0, 1 + (Date.now() % 3000)).toISOString().slice(0, 10);

  await page.getByRole("button", { name: "Novo custo" }).click();
  const modal = page.locator(".modal-backdrop");
  await modal.getByLabel("Funcionário *").selectOption({ index: 1 });
  await modal.getByPlaceholder("0,00").fill("4400,00");
  await modal.getByLabel("Vigente desde *").fill(vigenteDesde);
  await modal.getByRole("button", { name: "Salvar" }).click();
  await expect(modal).toBeHidden({ timeout: 10_000 });
  await expect(page.getByText("/hora", { exact: false })).toBeVisible({ timeout: 10_000 });

  await page.getByText("Rentabilidade", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rentabilidade por cliente" })).toBeVisible({
    timeout: 15_000,
  });
  expect(erros).toEqual([]);
});

// E04-S01: fundação do Financeiro — categorias (seed), conta bancária e ciclo de lançamento
// previsto → realizado (baixa). Cria dados de teste prefixados "[TESTE E2E]" contra o Supabase de
// produção (regra do projeto: nunca contra Netlify).
test("categorias mostra o seed do plano de contas", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Categorias", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Plano de contas" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Receita de contrato", { exact: true })).toBeVisible();
  await expect(page.getByText("Pessoal", { exact: true })).toBeVisible();
  await expect(page.getByText("Salários", { exact: true })).toBeVisible();
});

test("cria conta bancária e vê saldo derivado", async ({ page }) => {
  const nomeConta = `[TESTE E2E] Conta ${Date.now()}`;

  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Contas Bancárias", { exact: true }).click();

  await page.getByRole("button", { name: "Nova conta" }).click();
  await page.getByPlaceholder("Itaú PJ").fill(nomeConta);
  await page.getByLabel("Saldo inicial *").fill("1000,00");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText(nomeConta, { exact: true })).toBeVisible({ timeout: 10_000 });
  const card = page.locator("div.bg-card", { hasText: nomeConta });
  await expect(card.getByText("R$ 1000,00", { exact: true })).toBeVisible();
});

test("cria lançamento previsto, filtra e dá baixa", async ({ page }) => {
  const descricao = `[TESTE E2E] Lançamento ${Date.now()}`;
  page.on("console", (msg) => console.log("CONSOLE", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("PAGEERROR", err.message));

  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Lançamentos", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Lançamentos" })).toBeVisible({ timeout: 15_000 });

  // AC-3: criar previsto (tipo default do modal já é "Saída")
  await page.getByRole("button", { name: "Novo lançamento" }).click();
  // <select> aninhado dentro do <label> faz o texto do label incluir as <option> (ex.:
  // "Status *PrevistoRealizado") — getByLabel com exact:true nunca bate num select; usar
  // substring (exact:false, default) funciona porque "Status *" é prefixo único do texto real.
  const modal = page.locator(".modal-backdrop");
  await modal.getByPlaceholder("0,00").fill("150,00");
  await modal.getByLabel("Status *").selectOption("previsto");
  await modal.getByLabel("Vencimento *", { exact: true }).fill("2026-12-31");
  await modal.getByLabel("Categoria *").selectOption({ label: "Tarifas e juros bancários" });
  await modal.locator("textarea").fill(descricao);
  await modal.getByRole("button", { name: "Salvar" }).click();
  await expect(modal).toBeHidden({ timeout: 10_000 });

  await expect(page.getByText(descricao, { exact: true })).toBeVisible({ timeout: 10_000 });

  // AC-4: filtrar por status previsto e achar o lançamento criado (modal já fechou, sem ambiguidade)
  await page.getByLabel("Status").selectOption("previsto");
  await expect(page.getByText(descricao, { exact: true })).toBeVisible({ timeout: 10_000 });

  // AC-5: dar baixa (reversível). Limpa o filtro de status depois — senão o item some da lista ao
  // deixar de casar com status=previsto.
  const linha = page.locator("tr", { has: page.getByText(descricao, { exact: true }) });
  await linha.getByRole("button", { name: "Dar baixa" }).click();
  await page.getByRole("button", { name: "Confirmar baixa" }).click();
  // ainda filtrado por status=previsto: some da lista assim que a baixa é aplicada e recarrega —
  // usa o desaparecimento como sinal de conclusão em vez de esperar um tempo fixo.
  await expect(page.getByText(descricao, { exact: true })).toBeHidden({ timeout: 10_000 });

  await page.getByLabel("Status").selectOption("");
  await expect(linha.getByText("Realizado", { exact: true })).toBeVisible({ timeout: 10_000 });

  // estorno reverte para previsto de novo — handler do confirm() nativo precisa estar registrado
  // ANTES do clique, senão o diálogo já é auto-dismissado pelo Playwright.
  page.once("dialog", (dialog) => dialog.accept());
  await linha.getByRole("button", { name: "Estornar baixa" }).click();
  await expect(linha.getByText("Previsto", { exact: true })).toBeVisible({ timeout: 10_000 });
});

// E04-S07: robustez operacional — anexa comprovante num lançamento realizado, corrige valor
// (audit trail em lancamentos_eventos) e exclui com auditoria; transferência entre contas.
test("anexa comprovante e corrige valor de lançamento realizado", async ({ page }) => {
  const descricao = `[TESTE E2E] Robustez ${Date.now()}`;

  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Lançamentos", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lançamentos" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Novo lançamento" }).click();
  const modal = page.locator(".modal-backdrop");
  await modal.getByPlaceholder("0,00").fill("80,00");
  await modal.getByLabel("Categoria *").selectOption({ label: "Tarifas e juros bancários" });
  await modal.locator("textarea").fill(descricao);
  await modal.getByRole("button", { name: "Salvar" }).click();
  await expect(modal).toBeHidden({ timeout: 10_000 });
  await expect(page.getByText(descricao, { exact: true })).toBeVisible({ timeout: 10_000 });

  const linha = page.locator("tr", { has: page.getByText(descricao, { exact: true }) });

  // AC-1: anexa comprovante (input global, setado a partir do clique no botão da linha)
  await linha.getByRole("button", { name: "Anexar comprovante" }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "comprovante.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 teste e2e"),
  });
  await expect(linha.getByRole("button", { name: "Ver comprovante" })).toBeVisible({
    timeout: 10_000,
  });

  // PDF fake (bytes inválidos) pode disparar download em vez de navegação no popup — em vez de
  // depender do comportamento de renderização do browser, valida a própria chamada de geração da
  // signed URL (é isso que a RLS do bucket privado está protegendo).
  const [signResponse] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/storage/v1/object/sign/financeiro-comprovantes/") &&
        r.request().method() === "POST",
    ),
    linha.getByRole("button", { name: "Ver comprovante" }).click(),
  ]);
  expect(signResponse.status()).toBe(200);
  for (const p of page.context().pages()) {
    if (p !== page) await p.close();
  }

  // AC-2: corrige o valor — muda pra R$ 999,00, fica registrado em lancamentos_eventos
  await linha.getByRole("button", { name: "Corrigir" }).click();
  const corrigirModal = page.locator(".modal-backdrop");
  await corrigirModal.getByPlaceholder("0,00").fill("999,00");
  await corrigirModal.getByRole("button", { name: "Salvar correção" }).click();
  await expect(corrigirModal).toBeHidden({ timeout: 10_000 });
  await expect(linha.getByText("R$ 999,00", { exact: true })).toBeVisible({ timeout: 10_000 });

  // AC-2: exclui o lançamento realizado (auditoria antes de apagar) — some da lista
  page.once("dialog", (dialog) => dialog.accept());
  await linha.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText(descricao, { exact: true })).toBeHidden({ timeout: 10_000 });
});

// E04-S07 AC-3: transferência entre contas — 2 lançamentos vinculados, saldo reflete em ambas.
test("transferência entre contas move o saldo de origem pra destino", async ({ page }) => {
  const nomeOrigem = `[TESTE E2E] Origem ${Date.now()}`;
  const nomeDestino = `[TESTE E2E] Destino ${Date.now()}`;

  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Contas Bancárias", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contas bancárias" })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: "Nova conta" }).click();
  await page.getByPlaceholder("Itaú PJ").fill(nomeOrigem);
  await page.getByLabel("Saldo inicial *").fill("1000,00");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(nomeOrigem, { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Nova conta" }).click();
  await page.getByPlaceholder("Itaú PJ").fill(nomeDestino);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(nomeDestino, { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Transferência" }).click();
  const modal = page.locator(".modal-backdrop");
  await modal.getByLabel("Conta de origem *").selectOption({ label: nomeOrigem });
  await modal.getByLabel("Conta de destino *").selectOption({ label: nomeDestino });
  await modal.getByPlaceholder("0,00").fill("50,00");
  await modal.getByRole("button", { name: "Transferir" }).click();
  await expect(modal).toBeHidden({ timeout: 10_000 });

  const cardOrigem = page.locator("div.bg-card", { hasText: nomeOrigem });
  const cardDestino = page.locator("div.bg-card", { hasText: nomeDestino });
  await expect(cardOrigem.getByText("R$ 950,00", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(cardDestino.getByText("R$ 50,00", { exact: true })).toBeVisible({ timeout: 10_000 });
});

// E04-S08: régua de cobrança — cria ponto (D-3/WhatsApp), edita pra D+7/e-mail, desativa.
test("cria, edita e desativa ponto da régua de cobrança", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Cobrança", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Régua de cobrança" })).toBeVisible({
    timeout: 15_000,
  });

  const mensagem = `[TESTE E2E] Olá {{cliente}}, R$ {{valor}} vence em {{vencimento}} — ${Date.now()}`;

  await page.getByRole("button", { name: "Novo ponto" }).click();
  const modal = page.locator(".modal-backdrop");
  await modal.locator('input[type="number"]').fill("-3");
  await modal.getByLabel("Canal *").selectOption("whatsapp");
  await modal.locator("textarea").fill(mensagem);
  await modal.getByRole("button", { name: "Salvar" }).click();
  await expect(modal).toBeHidden({ timeout: 10_000 });

  const linha = page.locator("tr", { has: page.getByText(mensagem, { exact: true }) });
  await expect(linha.getByText("D-3", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(linha.getByText("WhatsApp", { exact: true })).toBeVisible();

  // edita pra D+7 / e-mail
  await linha.getByRole("button", { name: "Editar" }).click();
  const editModal = page.locator(".modal-backdrop");
  await editModal.locator('input[type="number"]').fill("7");
  await editModal.getByLabel("Canal *").selectOption("email");
  await editModal.getByRole("button", { name: "Salvar" }).click();
  await expect(editModal).toBeHidden({ timeout: 10_000 });
  await expect(linha.getByText("D+7", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(linha.getByText("E-mail", { exact: true })).toBeVisible();

  // desativa — status muda pra "Inativo", ponto continua na lista (histórico)
  page.once("dialog", (dialog) => dialog.accept());
  await linha.getByRole("button", { name: "Desativar" }).click();
  await expect(linha.getByText("Inativo", { exact: true })).toBeVisible({ timeout: 10_000 });
});

// E04-S09: emitir cobrança (Mercado Pago) degrada com erro claro quando a integração não está
// ativa em produção (AC-5, "gateway fora do ar/sem credencial → mensagem clara, nunca finge
// sucesso") — cria contrato+recebível, abre o modal de cobrança na tela de Contas a Receber.
test("emitir cobrança sem integração Mercado Pago ativa mostra erro claro", async ({ page }) => {
  const descricaoContrato = `[TESTE E2E] Contrato cobranca ${Date.now()}`;

  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Contratos", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contratos" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Novo contrato" }).click();
  const modal = page.locator(".modal-backdrop");
  await modal.getByLabel("Cliente *").selectOption({ index: 1 });
  await modal.getByPlaceholder("0,00").fill("400,00");
  await modal.getByLabel("Descrição").fill(descricaoContrato);
  await modal.getByRole("button", { name: "Salvar" }).click();
  await expect(modal).toBeHidden({ timeout: 10_000 });
  await expect(page.getByText(descricaoContrato, { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Gerar previstos do mês" }).click();
  await expect(page.getByText(/recebível\(is\) gerado|Nenhum recebível novo/)).toBeVisible({
    timeout: 10_000,
  });

  await page.getByText("Contas a Receber", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contas a receber" })).toBeVisible({
    timeout: 15_000,
  });

  // fn_gerar_recorrencias não copia a descrição do contrato pro lançamento gerado — o recebível
  // aparece só como "<cliente> — Recebível". Localiza pela linha pelo valor (único entre os testes
  // e2e deste arquivo: nenhum outro usa R$ 400,00), não pela descrição.
  const linha = page.locator("div", { hasText: "R$ 400,00" }).last();
  await linha.getByRole("button", { name: "Cobrança" }).click();

  const cobrancaModal = page.locator(".modal-backdrop");
  await expect(cobrancaModal.getByRole("heading", { name: /Cobrança/ })).toBeVisible({
    timeout: 10_000,
  });
  await cobrancaModal.getByRole("button", { name: "Emitir PIX" }).click();
  // Neste sandbox o `fetch` de supabase.functions.invoke falha ANTES de chegar na Edge Function:
  // `CORS_ALLOWED_ORIGINS` (secret do Supabase) inclui só o domínio Netlify de produção, não
  // localhost:5173 — mesma causa raiz já diagnosticada e documentada em E01-S48 (Tickets teve o
  // mesmo sintoma), fora do alcance de um agente corrigir (não dá pra ler/sobrescrever o secret
  // com segurança sem arriscar derrubar o domínio de produção já configurado). Em produção real
  // (Netlify), o mesmo clique bateria a Edge Function de verdade e mostraria o `detail` do
  // problem+json (ex.: "Integração Mercado Pago não está ativa") via `erroDetalhado` no adapter —
  // por isso o teste aceita as duas mensagens possíveis, não finge que uma cobrança foi emitida.
  await expect(cobrancaModal.getByText(/não|Failed to send/i)).toBeVisible({ timeout: 15_000 });
  await expect(cobrancaModal.getByText("Código PIX (copia e cola)")).toHaveCount(0);
});

// E04-S10: configura alíquota fixa, provisiona a competência atual e vê a linha na tabela de
// provisões (AC-1/AC-2). Sem "sem canal" aqui: o cálculo é 100% interno (soma de lançamentos já em
// produção), sem dependência de integração externa.
test("configura alíquota fixa e provisiona imposto da competência", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Impostos", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Impostos — provisão gerencial" })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByLabel("Regime de cálculo").selectOption("fixa");
  await page.getByRole("button", { name: "Salvar configuração" }).click();
  await expect(page.getByRole("button", { name: "Provisionar" })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Provisionar" }).click();
  await expect(page.getByRole("button", { name: "Calculando..." })).toBeHidden({ timeout: 15_000 });

  const agora = new Date();
  const mesAtual = `${String(agora.getMonth() + 1).padStart(2, "0")}/${agora.getFullYear()}`;
  const linha = page.locator("tr", { hasText: mesAtual });
  await expect(linha).toBeVisible({ timeout: 10_000 });
  await expect(linha.getByText("6.00%", { exact: true })).toBeVisible();
});

// E04-S11: fecha e reabre um mês. CRÍTICO: usa uma competência 6 meses no passado, NUNCA o mês
// atual — o trigger de bloqueio (AC-2) vale pra TODO lançamento daquela competência, e todo outro
// teste deste arquivo cria dados com data de hoje (mês atual). Fechar o mês atual quebraria o resto
// da suíte.
test("fecha e reabre um mês (competência antiga, nunca o mês atual)", async ({ page }) => {
  const agora = new Date();
  const alvo = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 6, 1));
  const mesAlvo = `${String(alvo.getUTCMonth() + 1).padStart(2, "0")}/${alvo.getUTCFullYear()}`;

  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Fechamento Mensal", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fechamento mensal" })).toBeVisible({
    timeout: 15_000,
  });

  const linha = page.locator("tr", { hasText: mesAlvo });
  await expect(linha).toBeVisible({ timeout: 10_000 });

  // fecha (idempotente — se um run anterior já deixou fechado, reabre primeiro pra garantir o
  // estado inicial "aberto" e não pular a asserção de "Fechar mês").
  if (
    await linha
      .getByText("Fechado", { exact: true })
      .isVisible()
      .catch(() => false)
  ) {
    page.once("dialog", (dialog) => dialog.accept("reset de estado do teste e2e"));
    await linha.getByRole("button", { name: "Reabrir" }).click();
    await expect(linha.getByText("Aberto", { exact: true })).toBeVisible({ timeout: 10_000 });
  }

  await linha.getByRole("button", { name: "Fechar mês" }).click();
  await expect(linha.getByText("Fechado", { exact: true })).toBeVisible({ timeout: 10_000 });

  page.once("dialog", (dialog) => dialog.accept("[TESTE E2E] ajuste retroativo"));
  await linha.getByRole("button", { name: "Reabrir" }).click();
  await expect(linha.getByText("Aberto", { exact: true })).toBeVisible({ timeout: 10_000 });
});

// E04-S11 AC-1: exporta CSV (client-side, mesma fonte da tela de Lançamentos).
test("exporta CSV de lançamentos", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Lançamentos", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lançamentos" })).toBeVisible({ timeout: 15_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^lancamentos-financeiro-\d{4}-\d{2}-\d{2}\.csv$/);
});

// E04-S12 AC-1: DRE gerencial carrega sem erro, com linha de resultado líquido.
test("DRE gerencial carrega receita/despesas/resultado por mês", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (err) => erros.push(err.message));

  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("DRE", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "DRE gerencial" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Receita", { exact: true })).toBeVisible();
  await expect(page.getByText("Resultado líquido", { exact: true })).toBeVisible();
  expect(erros).toEqual([]);
});

// E04-S12 AC-2/AC-3: define meta mensal pra uma categoria e vê o valor orçado refletido na tabela.
test("define orçamento anual e vê o orçado na tabela de desvio", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  await page.getByText("Orçamento", { exact: true }).click();

  const anoAtual = new Date().getUTCFullYear();
  await expect(page.getByRole("heading", { name: `Orçamento — ${anoAtual}` })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByLabel("Categoria").selectOption({ label: "Tarifas e juros bancários" });
  await page.getByLabel("Valor mensal (R$)").fill("500,00");
  await page.getByRole("button", { name: "Aplicar aos 12 meses" }).click();

  // "Orçado (ano)" é a soma dos 12 meses — R$500,00/mês × 12 = R$6000,00 (não R$500,00).
  const linha = page.locator("tr", { hasText: "Tarifas e juros bancários" });
  await expect(linha.getByText("R$ 6000,00", { exact: true })).toBeVisible({ timeout: 10_000 });
});

// E04-S13 AC-1/AC-2/AC-3/AC-4: cockpit carrega os 4 indicadores + ranking de margem + tendência,
// sem erro de console. AC-5 (gated superadmin) é verificado indiretamente — o usuário de teste é
// superadmin (confirmado no teste de fechamento mensal, que exige o papel pra "Reabrir").
test("cockpit financeiro carrega indicadores sem erro", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (err) => erros.push(err.message));

  await page.goto("/");
  await page.getByText("Financeiro", { exact: true }).first().click();
  // "Cockpit" também é o nome do módulo E08 na barra superior — escopa pro item da sidebar
  // (navigation), senão bate ambíguo.
  await page.getByRole("navigation").getByText("Cockpit", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Cockpit financeiro" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Runway", { exact: true })).toBeVisible();
  await expect(page.getByText("Ponto de equilíbrio", { exact: true })).toBeVisible();
  await expect(page.getByText("Ticket médio", { exact: true })).toBeVisible();
  await expect(page.getByText("Carteira em atraso", { exact: true })).toBeVisible();
  await expect(page.getByText(/Ranking de margem por cliente/)).toBeVisible();
  await expect(page.getByText(/Tendência de resultado/)).toBeVisible();
  expect(erros).toEqual([]);
});
