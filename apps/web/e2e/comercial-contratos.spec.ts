import { expect, test } from "@playwright/test";

// E03-S07. Ciclo completo: oportunidade → proposta → composição → rascunho→em_revisao→aprovada→
// enviada→aceita (todos os botões de status genéricos existem na tela interna — a máquina de
// estados não distingue quem clica; só "enviada" tem caminho especial porque gera PDF antes,
// E03-S06) → "Gerar contrato" → Contratos → Ativar (cria o plano no Financeiro, move a
// oportunidade pra 'ganha', E03-S07 AC-4/AC-7) → Encerrar (AC-8, não apaga histórico).
test("Proposta aceita gera contrato, ativa (cria plano no Financeiro) e encerra", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Comercial", { exact: true }).first().click();
  await page.getByTitle("Contas", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible({ timeout: 15_000 });

  const titulo = `[TESTE E2E] Oportunidade contrato ${Date.now()}`;
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
  await page.getByLabel("Tipo da proposta").selectOption("residente");
  await page.getByRole("button", { name: "Nova proposta" }).click();
  await expect(page.getByText(/Rascunho/).first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await page.getByLabel("Descrição").last().fill("Item de teste E2E contrato");
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
  await page.getByRole("button", { name: /Enviar \(gera PDF/ }).click();
  await expect(page.getByText("Enviada").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Aceita", exact: true }).click();
  await expect(page.getByText("Aceita").first()).toBeVisible({ timeout: 15_000 });

  // AC-2: gerar contrato a partir da proposta aceita.
  await page.getByRole("button", { name: "Gerar contrato" }).click();
  await expect(page.getByText("Contrato criado")).toBeVisible({ timeout: 15_000 });

  // AC-4/AC-7: ativar na tela de Contratos — cria o plano no Financeiro, move a oportunidade.
  await page.getByTitle("Contratos", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contratos" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Ativar" }).first().click();
  await expect(page.getByText("Ativo").first()).toBeVisible({ timeout: 15_000 });

  // AC-8: encerrar não quebra a tela nem exige motivo vazio.
  await page.getByRole("button", { name: "Encerrar" }).first().click();
  await page.getByLabel("Motivo do encerramento").fill("[TESTE E2E] Encerramento de teste");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Encerrado").first()).toBeVisible({ timeout: 15_000 });
});
