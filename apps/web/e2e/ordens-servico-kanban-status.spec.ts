import { expect, test } from "@playwright/test";

// E01-S150: além do drag-and-drop nativo (frágil em trackpad), todo card do Kanban tem um select
// de status embutido — jeito confiável e acessível de mover OS entre fases sem depender do gesto
// de arrastar. Usa a mesma OS de fixture ("CH-0061 / teste titulo") já usada por outros specs de
// Chamados/OS — reverte ao final para não deixar o board sujo para o próximo teste/uso real.
test("card do Kanban move OS entre fases via select (sem drag)", async ({ page }) => {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByTitle("Chamados", { exact: true }).click();
  await page.getByRole("button", { name: "Kanban" }).click();

  const colunaPlanejamento = page
    .getByRole("button", { name: "Ocultar coluna Planejamento" })
    .locator("xpath=ancestor::div[contains(@class,'w-72')][1]");
  const colunaBacklog = page
    .getByRole("button", { name: "Ocultar coluna Backlog" })
    .locator("xpath=ancestor::div[contains(@class,'w-72')][1]");
  await expect(colunaPlanejamento).toBeVisible({ timeout: 15_000 });

  const selectDoCard = colunaPlanejamento
    .getByText("CH-0061", { exact: true })
    .locator("xpath=ancestor::div[@draggable='true'][1]")
    .getByLabel(/Mover CH-0061 para outra fase/);
  await expect(selectDoCard).toBeVisible();

  await selectDoCard.selectOption("backlog");
  await expect(colunaBacklog.getByText("CH-0061", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(colunaPlanejamento.getByText("CH-0061", { exact: true })).toHaveCount(0);

  // reverte para não deixar a fixture fora do lugar esperado por outros specs
  const selectNoBacklog = colunaBacklog
    .getByText("CH-0061", { exact: true })
    .locator("xpath=ancestor::div[@draggable='true'][1]")
    .getByLabel(/Mover CH-0061 para outra fase/);
  await selectNoBacklog.selectOption("planejamento");
  await expect(colunaPlanejamento.getByText("CH-0061", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
});
