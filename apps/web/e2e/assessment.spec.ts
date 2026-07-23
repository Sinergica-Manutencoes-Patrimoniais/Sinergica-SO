import { expect, test } from "@playwright/test";

// E01-S90 AC-1/AC-2/AC-4: cria um cliente de teste dedicado, abre um assessment pra ele, confirma
// o estado vazio (AC-1), tenta importar um questionário com ID inexistente (D2/casos de borda —
// não deve quebrar, só não trazer itens) e confirma que o assessment aparece na Visão 360 (AC-4).
test("cria assessment, importa questionário inexistente sem quebrar, aparece na Visão 360", async ({
  page,
}) => {
  const sufixo = Date.now();
  const nomeCliente = `[TESTE E2E] Cliente S90 ${sufixo}`;

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).click();
  await page.getByRole("button", { name: "Novo cliente" }).click();
  await page.getByLabel("Nome *").fill(nomeCliente);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(nomeCliente, { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  });

  // ── AC-1: novo assessment pro cliente de teste ─────────────────────────────────────────────
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Assessment", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Assessment" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Novo assessment" }).click();
  await expect(page.getByRole("heading", { name: "Novo assessment" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByLabel("Cliente *").selectOption({ label: nomeCliente });
  await page.getByLabel("Motivo *").selectOption({ label: "Início de contrato" });
  await page.getByRole("button", { name: "Criar assessment" }).click();

  await expect(page.getByText(nomeCliente)).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByText("Nenhum item ainda — importe um questionário do Auvo pra começar."),
  ).toBeVisible({ timeout: 10_000 });

  // ── D2/caso de borda: ID de tarefa Auvo inexistente não quebra — só não traz item ─────────────
  await page.getByRole("button", { name: "Importar questionário Auvo" }).click();
  await page.getByLabel("ID da tarefa Auvo (questionário concluído) *").fill("999999999");
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(
    page.getByText("Nenhum item ainda — importe um questionário do Auvo pra começar."),
  ).toBeVisible({ timeout: 10_000 });

  // ── AC-4: assessment vigente aparece na Visão 360 do cliente ───────────────────────────────
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Clientes", { exact: true }).click();
  await page
    .getByPlaceholder("Buscar por cliente, cidade, contato, CNPJ ou ID Auvo")
    .fill(nomeCliente);
  await page.getByText(nomeCliente, { exact: true }).first().click();
  // Escopado a `main` — "Assessment" também é o item de navegação lateral (mesma label da aba).
  await page.getByRole("main").getByText("Assessment", { exact: true }).click();
  await expect(page.getByRole("main").getByText("Início de contrato")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(/0 de 0 itens já derivados/)).toBeVisible();
});
