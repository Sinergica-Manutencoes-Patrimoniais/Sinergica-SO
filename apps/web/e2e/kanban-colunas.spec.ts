import { expect, test } from "@playwright/test";

// E01-S84 AC-2/AC-1: oculta uma coluna do Kanban de OS, confirma que ela some (o chip "Colunas
// ocultas" aparece com o botão de reexibir) e que a preferência sobrevive a um reload da página
// (persistida por usuário). Termina reexibindo a coluna, pra não deixar a preferência real do
// usuário de teste num estado diferente do padrão (mesmo cuidado de "restaurar ao padrão seguro"
// usado nos specs de fechamento mensal do Financeiro). Usa os `aria-label` dos botões de
// ocultar/mover (únicos por coluna) em vez de `getByText`, que colide com o texto "Cancelado" nos
// `<option>` de status de cada card real já existente em produção.
test("ocultar/reexibir coluna do Kanban persiste entre reloads", async ({ page }) => {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Ordens de Serviço", { exact: true }).click();
  await page.getByRole("button", { name: "Kanban" }).click();

  const ocultarCancelado = page.getByRole("button", { name: "Ocultar coluna Cancelado" });
  await expect(ocultarCancelado).toBeVisible({ timeout: 15_000 });

  await ocultarCancelado.click();
  await expect(ocultarCancelado).not.toBeVisible();
  const chipCancelado = page.getByRole("button", { name: "Cancelado" });
  await expect(chipCancelado).toBeVisible();

  await page.reload();
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Ordens de Serviço", { exact: true }).click();
  await page.getByRole("button", { name: "Kanban" }).click();

  await expect(page.getByRole("button", { name: "Ocultar coluna Cancelado" })).not.toBeVisible({
    timeout: 15_000,
  });
  const chipCanceladoDepoisDoReload = page.getByRole("button", { name: "Cancelado" });
  await expect(chipCanceladoDepoisDoReload).toBeVisible();

  await chipCanceladoDepoisDoReload.click();
  await expect(page.getByRole("button", { name: "Ocultar coluna Cancelado" })).toBeVisible();
});

// E01-S84 AC-3: a coluna virtual "Preventiva" existe e fica entre Corretiva e Planejamento (ordem
// padrão) — verificado pela posição relativa dos botões "Ocultar coluna <X>", únicos por coluna.
test("coluna Preventiva aparece entre Corretiva e Planejamento", async ({ page }) => {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Ordens de Serviço", { exact: true }).click();
  await page.getByRole("button", { name: "Kanban" }).click();

  await expect(page.getByRole("button", { name: "Ocultar coluna Preventiva" })).toBeVisible({
    timeout: 15_000,
  });

  const botoes = page.getByRole("button", { name: /^Ocultar coluna / });
  const total = await botoes.count();
  const labels: string[] = [];
  for (let indice = 0; indice < total; indice++) {
    const ariaLabel = await botoes.nth(indice).getAttribute("aria-label");
    labels.push(ariaLabel?.replace("Ocultar coluna ", "") ?? "");
  }

  const indiceCorretiva = labels.indexOf("Corretiva");
  const indicePreventiva = labels.indexOf("Preventiva");
  const indicePlanejamento = labels.indexOf("Planejamento");
  expect(indiceCorretiva).toBeGreaterThanOrEqual(0);
  expect(indicePreventiva).toBe(indiceCorretiva + 1);
  expect(indicePlanejamento).toBe(indicePreventiva + 1);
});
