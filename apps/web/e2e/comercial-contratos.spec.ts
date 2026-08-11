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

  await page.getByRole("button", { name: "Oportunidade" }).first().click();
  await expect(page.getByRole("heading", { name: /Nova oportunidade/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Título").fill(`[TESTE E2E] Oportunidade contrato ${Date.now()}`);
  await page.getByRole("button", { name: "Criar oportunidade" }).click();
  await expect(page.getByRole("heading", { name: /Nova oportunidade/ })).toBeHidden({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: "Propostas" }).first().click();
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
