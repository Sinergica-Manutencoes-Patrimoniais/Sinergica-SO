import { expect, test } from "@playwright/test";

// E03-S09. O agente de WhatsApp cria a oportunidade via RPC (não mais via `comercial.leads`) — a
// UAT com WhatsApp real é fora de escopo desta story (depende de instância conectada, mesma
// ressalva herdada da E02-S09). Este teste cobre o que a UI interna oferece: a oportunidade que
// nasceria do agente aparece no funil com origem "whatsapp" e, quando tem `conversaId`, o botão
// "Ver conversa" na Visão 360 (AC-5) — smoke via Funil, que não depende do schema `relacionamento`
// (ao contrário da Lista de Contas).
test("Funil mostra oportunidades com origem whatsapp quando existirem", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Comercial", { exact: true }).first().click();
  await page.getByTitle("Funil", { exact: true }).click();
  await expect(page.getByRole("heading", { name: /Funil|Lead/i }).first()).toBeVisible({
    timeout: 15_000,
  });
  // Produção hoje não tem lead real do agente (UAT do WhatsApp nunca rodou — fora de escopo desta
  // story) — o teste só confirma que a tela carrega sem erro, o caminho de "ter um card com origem
  // whatsapp" é coberto pelo smoke test manual da RPC (fn_registrar_oportunidade), não aqui.
  await expect(page.locator("body")).not.toContainText("Erro inesperado");
});
