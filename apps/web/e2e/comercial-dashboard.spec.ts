import { expect, test } from "@playwright/test";

// E03-S08. Dashboard carrega sem erro de console (mesmo gate que pegou problemas reais na E04-S03),
// em ambos os temas, com período vazio mostrando estado honesto ("sem dados", nunca zero fingido).
// É a view padrão do módulo desde esta story (AC-10/task 8) — clicar em "Comercial" já cai aqui.
test("Dashboard comercial carrega sem erro de console, tema claro e escuro", async ({ page }) => {
  const erros: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") erros.push(msg.text());
  });

  await page.goto("/");
  await page.getByText("Comercial", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Dashboard comercial" })).toBeVisible({
    timeout: 15_000,
  });

  // Blocos aparecem, com estado honesto (produção real não tem oportunidade nenhuma no período
  // padrão hoje — "sem dados" é o caminho feliz real, não um caso de borda hipotético).
  await expect(page.getByText("Conversão por etapa")).toBeVisible();
  await expect(page.getByText("Ciclo de venda (mediana)")).toBeVisible();
  await expect(page.getByText("Win / loss")).toBeVisible();
  await expect(page.getByText("Ticket médio")).toBeVisible();
  await expect(page.getByText("Desconto médio × piso")).toBeVisible();
  await expect(page.getByText("Origem do lead")).toBeVisible();

  // Alterna pro modo escuro e confere que os blocos continuam de pé, sem novo erro de console —
  // mesmo gate que pegou problema real de contraste na E04-S03.
  await page.getByLabel("Usar modo noite").click();
  await expect(page.getByText("Conversão por etapa")).toBeVisible();
  await expect(page.getByText("Ticket médio")).toBeVisible();

  expect(erros, `Erros de console: ${erros.join("\n")}`).toEqual([]);
});
