import { expect, test } from "@playwright/test";

// E03-S05. Fluxo completo do levantamento de pré-venda: oportunidade → "Novo levantamento" (AC-1)
// → aparece na lista da Conta (AC-7) → proposta tipo Levantamento vincula o Assessment (AC-4) →
// importar itens acrescenta à composição (AC-5). O preenchimento em campo (AC-3) reusa a tela do
// PCM e não é coberto aqui — é o mesmo Assessment já testado em `inspecao-gutd.spec.ts` (E01-S143).
test("Cria levantamento a partir da oportunidade e ele aparece na Visão 360", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Comercial", { exact: true }).first().click();
  // Dashboard é a view padrão do módulo desde a E03-S08 — precisa navegar pra Contas explicitamente.
  await page.getByTitle("Contas", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible({ timeout: 15_000 });

  // AC-1: o atalho "novo levantamento" só existe a partir de uma oportunidade — cria uma primeiro.
  // Fixa o nome da Conta antes de clicar — precisa dele pra abrir a Visão 360 da MESMA Conta.
  const linha = page
    .getByRole("row")
    .filter({ has: page.getByRole("button", { name: "Oportunidade" }) })
    .first();
  const nomeConta = await linha.locator("td").first().locator("button").innerText();
  await linha.getByRole("button", { name: "Oportunidade" }).click();
  await expect(page.getByRole("heading", { name: /Nova oportunidade/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Título").fill(`[TESTE E2E] Oportunidade levantamento ${Date.now()}`);
  await page.getByRole("button", { name: "Criar oportunidade" }).click();
  await expect(page.getByRole("heading", { name: /Nova oportunidade/ })).toBeHidden({
    timeout: 15_000,
  });
  // Radix Dialog.Overlay ("anim-overlay") some com fade animado - o DOM pode continuar
  // clicavel um instante depois do heading sumir, engolindo o proximo clique (achado real).
  await expect(page.locator(".anim-overlay")).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: nomeConta })).not.toContainText(
    "Sem oportunidade",
    { timeout: 15_000 },
  );

  // "Novo levantamento" e "Propostas" não têm mais botão inline na ContasPage desde a consolidação
  // da Visão 360 (ADR-0020) — ambos moraram pra dentro da aba Comercial da Visão 360 do PCM. Existem
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

  // AC-1/AC-7: pede o levantamento e ele aparece na lista da Conta, na aba Comercial da Visão 360.
  await page.getByRole("button", { name: "Novo levantamento" }).click();
  await expect(page.getByText("Levantamento de pré-venda").first()).toBeVisible({
    timeout: 15_000,
  });

  // AC-4: abre o editor de propostas, cria uma proposta tipo Levantamento e vincula o Assessment.
  await page.getByRole("button", { name: "Propostas" }).first().click();
  await page.getByLabel("Tipo da proposta").selectOption("levantamento");
  await page.getByRole("button", { name: "Nova proposta" }).click();
  await expect(page.getByText(/Rascunho/).first()).toBeVisible({ timeout: 15_000 });

  await expect(page.getByText("Vincular levantamento desta Conta")).toBeVisible();
  await page
    .getByLabel("Vincular levantamento desta Conta")
    .selectOption({ label: /Levantamento/ });
  await page.getByRole("button", { name: "Vincular" }).click();

  // AC-5: importar acrescenta — a composição começa vazia (nenhum item de achado no levantamento
  // recém-criado), então o aviso confirma "0 itens" sem erro, provando que o caminho não quebra.
  await page.getByRole("button", { name: "Importar itens do levantamento" }).click();
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByText(/item.*importad|Nenhum item/)).toBeVisible({ timeout: 15_000 });
});
