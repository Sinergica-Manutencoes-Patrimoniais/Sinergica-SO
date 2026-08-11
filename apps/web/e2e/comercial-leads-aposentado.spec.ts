import { expect, test } from "@playwright/test";

// E03-S10. Depois do drop de `comercial.leads` e da coluna `atendimento.conversas.lead_id`: o
// Inbox do Atendimento precisa continuar abrindo normalmente (é o que mais podia quebrar com a
// mudança de schema — AC-4) e o Funil do Comercial precisa continuar intacto (não depende de
// `comercial.leads` desde sempre, mas confirma que a limpeza da RPC/timeline não regrediu nada).
test("Inbox do Atendimento e Funil do Comercial carregam sem erro após aposentar comercial.leads", async ({
  page,
}) => {
  const erros: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") erros.push(msg.text());
  });

  await page.goto("/");
  await page.getByText("Atendimento · Zé", { exact: true }).first().click();
  await page.getByTitle("Inbox", { exact: true }).click();
  await expect(page.locator("body")).not.toContainText("Erro inesperado", { timeout: 15_000 });

  await page.getByText("Comercial", { exact: true }).first().click();
  await page.getByTitle("Funil", { exact: true }).click();
  await expect(page.getByRole("heading", { name: /Funil|Lead/i }).first()).toBeVisible({
    timeout: 15_000,
  });

  expect(erros, `Erros de console: ${erros.join("\n")}`).toEqual([]);
});
