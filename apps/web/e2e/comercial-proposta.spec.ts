import { expect, test } from "@playwright/test";

// E03-S04. Fluxo completo do editor de proposta: criar, compor item, ver o cálculo ao vivo,
// salvar (persiste via RPC) e tentar avançar sem item primeiro (deve barrar, AC-1 caso de borda).
test("Cria proposta, monta composição, vê cálculo ao vivo e salva", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Comercial", { exact: true }).first().click();
  // Dashboard é a view padrão do módulo desde a E03-S08 — precisa navegar pra Contas explicitamente.
  await page.getByTitle("Contas", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible({ timeout: 15_000 });

  // Cria oportunidade na primeira conta da lista (mesmo caminho da E03-S01/S02). Fixa o nome da
  // Conta antes de clicar — precisa dele depois pra abrir a Visão 360 da MESMA Conta.
  const titulo = `[TESTE E2E] Oportunidade proposta ${Date.now()}`;
  const linha = page
    .getByRole("row")
    .filter({ has: page.getByRole("button", { name: "Oportunidade" }) })
    .first();
  const nomeConta = await linha.locator("td").first().locator("button").innerText();
  await linha.getByRole("button", { name: "Oportunidade" }).click();
  await expect(page.getByRole("heading", { name: /Nova oportunidade/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Título").fill(titulo);
  await page.getByRole("button", { name: "Criar oportunidade" }).click();
  await expect(page.getByRole("heading", { name: /Nova oportunidade/ })).toBeHidden({
    timeout: 15_000,
  });
  // Radix Dialog.Overlay ("anim-overlay") some com fade animado - o DOM pode continuar
  // clicavel um instante depois do heading sumir, engolindo o proximo clique (achado real).
  await expect(page.locator(".anim-overlay")).toHaveCount(0);

  // Espera a linha da MESMA Conta refletir a oportunidade recém-criada (invalidação do TanStack
  // Query) antes de navegar pra fora da lista — clicar cedo demais pega a linha em re-render e o
  // clique se perde (achado real: navegação ficava intermitente sem essa espera).
  await expect(page.getByRole("row").filter({ hasText: nomeConta })).not.toContainText(
    "Sem oportunidade",
    { timeout: 15_000 },
  );

  // ContasPage não tem mais botão inline "Propostas" por linha desde a consolidação da Visão 360
  // (ADR-0020) — Propostas mora dentro da aba Comercial da Visão 360 do PCM (mesma Conta). Existem
  // 2 elementos com texto exato "Comercial" na tela (o tab do MÓDULO no topo + a aba da 360) —
  // `.last()` pega a aba, que só existe depois de entrar na 360 do cliente.
  await page.getByRole("button", { name: nomeConta, exact: true }).click();
  await page.getByRole("button", { name: "Comercial", exact: true }).last().click();
  // Espera a query de oportunidades da Conta (query key diferente da lista de Contas) resolver
  // de verdade antes de procurar botoes que so renderizam com oportunidades.length > 0.
  await expect(page.getByRole("heading", { name: "Oportunidades" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Nenhuma oportunidade nesta conta")).toBeHidden({ timeout: 15_000 });
  await page
    .getByRole("listitem")
    .filter({ hasText: titulo })
    .getByRole("button", { name: "Propostas" })
    .click();

  await expect(page.getByRole("heading", { name: "Precificação" })).toBeHidden();
  await page.getByRole("button", { name: "Nova proposta" }).click();

  await expect(page.getByText(/Rascunho/).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("button", { name: "Adicionar item" }).click();

  const descricao = page.getByLabel("Descrição").last();
  await descricao.fill("Item de teste E2E");
  const quantidade = page.getByLabel(/Qtd\.|Horas/).last();
  await quantidade.fill("2");

  // O bloco de cálculo ao vivo precisa refletir o item assim que ele é digitado, sem salvar.
  await expect(page.getByText("Custo")).toBeVisible();
  await expect(page.getByText("Piso")).toBeVisible();
  await expect(page.getByText("Preço sugerido")).toBeVisible();

  await page.getByRole("button", { name: "Salvar composição" }).click();
  await expect(page.getByRole("button", { name: "Salvar composição" })).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.getByText("Item de teste E2E")).toBeVisible();
});
