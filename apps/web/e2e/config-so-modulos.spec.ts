import { expect, test } from "@playwright/test";

// E01-S80 AC-2: "Grupos de Usuário" dentro do PCM é atalho pro hub global de Configurações (reusa
// GruposPage, nunca duplica o CRUD) — clicar leva pra fora do módulo PCM, direto na aba Grupos.
test("PCM > Configurações > Grupos de Usuário abre o hub global de Config na aba Grupos", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByRole("navigation").getByText("Grupos de Usuário", { exact: true }).click();

  const navGrupos = page.getByRole("navigation").getByText("Grupos", { exact: true });
  await expect(navGrupos).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Grupos", exact: true })).toBeVisible();
});

// E01-S80 AC-4: "Categorias Produto" não existe mais em nenhum lugar da navegação do PCM.
test("PCM não tem mais acesso a Categorias Produto na navegação", async ({ page }) => {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await expect(
    page.getByRole("navigation").getByText("Categorias Produto", { exact: true }),
  ).toHaveCount(0);
});

// E01-S80 AC-2/AC-3: os cadastros que viraram "config" continuam abrindo normalmente, só mudaram
// de agrupamento na sidebar (grupo "CONFIGURAÇÕES", sem quebrar o clique direto — mesmo padrão já
// usado nos outros grupos, nunca virou accordion/submenu).
test("cadastros movidos pro grupo Configurações continuam clicáveis direto", async ({ page }) => {
  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();

  await expect(
    page.getByRole("navigation").getByText("CONFIGURAÇÕES", { exact: true }),
  ).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("navigation").getByText("Equipes", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Equipes" })).toBeVisible({ timeout: 10_000 });
});
