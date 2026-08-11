import { expect, test } from "@playwright/test";

// E03-S14. O Guia do SO tratava o Comercial como "módulo planejado" (PaginaPlanejada) mesmo depois
// do épico inteiro ter sido entregue com dados reais. Esta story cria o ComercialGuia real — este
// teste confirma que a rota renderiza sem erro (import quebrado derruba a rota inteira) e que a
// Visão geral já não lista o Comercial entre os planejados.
test("Guia do SO mostra o Comercial como módulo real, não mais planejado", async ({ page }) => {
  const erros: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") erros.push(msg.text());
  });

  await page.goto("/");
  await page.getByText("Guia do SO", { exact: true }).first().click();

  // Visão geral: Comercial saiu da lista de planejados.
  await expect(page.getByText("Comercial, Marketing e Cockpit", { exact: false })).toHaveCount(0);
  await expect(
    page.getByText("PCM, Atendimento, Financeiro, Comercial e Área do Cliente", { exact: false }),
  ).toBeVisible({ timeout: 15_000 });

  // Página do Comercial: guia real, não mais "Planejado — ainda não construído".
  await page.getByTitle("Comercial", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Comercial", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Em uso — dado real", { exact: true })).toBeVisible();
  await expect(page.getByText("Planejado — ainda não construído", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Piso e desconto máximo", { exact: true }).first()).toBeVisible();

  expect(erros, `Erros de console: ${erros.join("\n")}`).toEqual([]);
});
