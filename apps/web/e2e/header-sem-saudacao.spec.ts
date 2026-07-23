import { expect, test } from "@playwright/test";

for (const viewport of [
  { nome: "desktop", width: 1440, height: 900 },
  { nome: "mobile", width: 390, height: 844 },
]) {
  test(`remove saudação e mantém conta no ${viewport.nome}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByText(/^Olá,/)).toHaveCount(0);
    await expect(page.getByTitle("Sair")).toBeAttached();
  });
}
