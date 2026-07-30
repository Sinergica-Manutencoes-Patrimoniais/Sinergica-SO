import { expect, test } from "@playwright/test";

test("Área do Cliente mostra central real e orienta acesso seguro", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Área do Cliente", exact: true })
    .click();

  await expect(page.getByRole("heading", { name: "Área do Cliente", exact: true })).toBeVisible();
  await expect(page.getByText("Portal implementado", { exact: true })).toBeVisible();
  await expect(page.getByText("Em construção", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Como liberar e testar um cliente", { exact: true })).toBeVisible();
  await expect(page.getByText("O que já está disponível", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Abrir Clientes", exact: true }).click();
  await expect(page.getByRole("navigation").getByText("Clientes", { exact: true })).toBeVisible();
});
