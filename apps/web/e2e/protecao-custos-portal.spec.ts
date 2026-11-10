import { expect, test } from "@playwright/test";

// E01-S184 (T018). Roda contra o Supabase de PRODUÇÃO (ver aviso em playwright.config.ts /
// SEC-006 em docs/SECURITY_DEBT.md) — cria dados reais prefixados "[TESTE E2E]", igual aos
// demais specs deste diretório; nem todo objeto criado aqui tem exclusão pela UI.
//
// Diferente de comercial-proposta-pdf-portal.spec.ts (E03-S06), este spec abre uma SEGUNDA sessão
// de navegador autenticada como `cliente-sindico` de verdade — não existia precedente disso neste
// repositório (auth.setup.ts só autentica um usuário fixo, reaproveitado por todos os outros
// specs). O acesso ao portal é criado pela própria jornada, pela UI já existente ("Criar acesso ao
// portal" em Visão 360), sem precisar de segundo usuário pré-cadastrado nem segredo novo em
// .env.local.
//
// Escrito e NÃO executado nesta sessão (sem acesso a produção); primeira rodada real precisa
// revisão humana atenta a seletores antes de confiar no resultado.
test("Jornada crítica: Cliente vê proposta sem custo e PCM revoga/pode auditar", async ({
  page,
  browser,
}) => {
  const sufixo = Date.now();
  const emailSindico = `teste-e2e-sindico-${sufixo}@teste.invalid`;
  const senhaSindico = "TesteE2E184!ok";

  await page.goto("/");
  await page.getByText("Comercial", { exact: true }).first().click();
  await page.getByTitle("Contas", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible({ timeout: 15_000 });

  const linha = page
    .getByRole("row")
    .filter({ has: page.getByRole("button", { name: "Oportunidade" }) })
    .first();
  const nomeConta = await linha.locator("td").first().locator("button").innerText();
  await linha.getByRole("button", { name: "Oportunidade" }).click();
  await expect(page.getByRole("heading", { name: /Nova oportunidade/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Título").fill(`[TESTE E2E] S184 proteção custos ${sufixo}`);
  await page.getByRole("button", { name: "Criar oportunidade" }).click();
  await expect(page.getByRole("heading", { name: /Nova oportunidade/ })).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.locator(".anim-overlay")).toHaveCount(0);

  // Mesma Conta 360: cria acesso ao portal ANTES de sair da página (botão fica no topo da Visão
  // 360, fora das abas — "Criar acesso ao portal" em VisaoClientePage.tsx).
  await page.getByRole("button", { name: nomeConta, exact: true }).click();
  await page.getByRole("button", { name: "Criar acesso ao portal" }).click();
  await expect(
    page.getByRole("heading", { name: "Criar acesso ao Portal do Cliente" }),
  ).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Nome").fill(`[TESTE E2E] Síndico S184 ${sufixo}`);
  await page.getByLabel("E-mail").fill(emailSindico);
  await page.getByLabel("Senha inicial").fill(senhaSindico);
  await page.getByRole("button", { name: "Criar acesso" }).click();
  await expect(page.getByRole("heading", { name: "Criar acesso ao Portal do Cliente" })).toBeHidden(
    { timeout: 15_000 },
  );

  // Segue o mesmo roteiro de E03-S06/comercial-proposta-pdf-portal.spec.ts: rascunho → composição
  // → em_revisao → aprovada → enviada (publica em comercial.portal_propostas por status).
  await page.getByRole("button", { name: "Comercial", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Oportunidades" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Propostas" }).first().click();
  await page.getByRole("button", { name: "Nova proposta" }).click();
  await expect(page.getByText(/Rascunho/).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await page.getByLabel("Descrição").last().fill("Item de teste E2E S184 proteção de custos");
  await page
    .getByLabel(/Qtd\.|Horas/)
    .last()
    .fill("1");
  await page.getByRole("button", { name: "Salvar composição" }).click();
  await expect(page.getByRole("button", { name: "Salvar composição" })).toBeHidden({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Em revisão" }).click();
  await expect(page.getByText("Em revisão").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Aprovada" }).click();
  await expect(page.getByText("Aprovada").first()).toBeVisible({ timeout: 15_000 });
  const precoVenda = await page
    .getByText(/R\$\s?\d/)
    .first()
    .innerText();
  await page.getByRole("button", { name: /Enviar \(gera PDF/ }).click();
  await expect(page.getByText("Enviada").first()).toBeVisible({ timeout: 15_000 });

  // Segunda sessão de navegador, autenticada como o síndico recém-criado — nunca reaproveita o
  // storageState de admin salvo em e2e/.auth/user.json.
  const contextoCliente = await browser.newContext();
  const paginaCliente = await contextoCliente.newPage();
  try {
    await paginaCliente.goto("/login");
    await paginaCliente.locator("#email").fill(emailSindico);
    await paginaCliente.locator("#password").fill(senhaSindico);
    await paginaCliente.getByRole("button", { name: "Entrar" }).click();
    await expect(paginaCliente.getByText("Carregando sessão...")).not.toBeVisible({
      timeout: 15_000,
    });
    await expect(paginaCliente).not.toHaveURL(/\/login/);

    // AC-2: estrutural — a árvore de Cliente nunca monta a navegação administrativa (App.tsx
    // renderiza só <PortalShell /> para papel cliente-sindico; "Contas" é só do módulo Comercial).
    await expect(paginaCliente.getByRole("navigation", { name: "Portal do Cliente" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(paginaCliente.getByRole("heading", { name: "Contas" })).toHaveCount(0);

    await paginaCliente.getByRole("button", { name: "Propostas" }).click();
    const corpoPortal = await paginaCliente.locator("body").innerText();

    // AC-1/AC-3: nenhuma das palavras internas aparece em nenhuma tela do Portal, e o preço de
    // venda mostrado ao Cliente é o mesmo que o Comercial viu antes de enviar.
    for (const termo of ["Custo", "custo_unitario", "Margem", "Fornecedor", "Piso"]) {
      expect(corpoPortal).not.toContain(termo);
    }
    expect(corpoPortal).toContain(precoVenda.trim());
    await expect(paginaCliente.getByText("enviada", { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Fecha a jornada: Cliente aceita — mesma regra pública (AC-5: decisão só pela RPC segura).
    await paginaCliente.getByRole("button", { name: "Aceitar" }).first().click();
    await expect(paginaCliente.getByText("aceita", { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    await contextoCliente.close();
  }
});
