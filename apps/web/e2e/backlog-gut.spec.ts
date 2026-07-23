import { expect, test } from "@playwright/test";

// E01-S83 AC-1/AC-4: "Novo item de backlog" cadastra direto da própria página de Backlog GUT (sem
// precisar passar por Ordens de Serviço) e o campo Observação (texto livre, distinto da descrição)
// persiste e aparece no tooltip da fila.
test("Novo item de backlog cadastra direto com observação e aparece na fila", async ({ page }) => {
  const titulo = `[TESTE E2E] Backlog ${Date.now()}`;

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Backlog GUT", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Backlog GUT" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Novo item de backlog" }).click();

  await expect(page.getByRole("heading", { name: "Nova Ordem de Serviço" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByPlaceholder("Ex: Reparo vazamento tubulação — Térreo").fill(titulo);
  await page
    .getByPlaceholder("Descreva o problema, evidências, restrições de acesso e contexto relevante.")
    .fill("Descrição do item de backlog (Playwright, E01-S83).");
  await page
    .getByPlaceholder("Observação livre — anotações internas, contexto adicional.")
    .fill("Aguardando autorização do síndico (teste E01-S83).");
  await page.getByRole("button", { name: "Criar OS" }).click();

  await expect(page.getByRole("button", { name: "Novo item de backlog" })).toBeVisible({
    timeout: 15_000,
  });
  const linha = page.getByText(titulo, { exact: true }).first();
  await expect(linha).toBeVisible({ timeout: 10_000 });

  // AC-4: observação aparece no tooltip do item (hover).
  await linha.hover();
  await expect(page.getByText("Observação: Aguardando autorização do síndico")).toBeVisible({
    timeout: 5_000,
  });
});
