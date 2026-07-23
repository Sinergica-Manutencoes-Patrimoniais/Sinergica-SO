import { expect, test } from "@playwright/test";

// E01-S85 AC-1: Configurações > Localização Auvo carrega a preferência real (separador/ordem) e
// mostra o preview. Só confere leitura — NÃO renomeia nenhuma Área/Local real nem move nenhum
// equipamento real: `pcm.equipamentos` já tem `writeEnabled:true` em produção (ADR-0006), então
// qualquer rename/move real dispararia um PATCH de verdade na conta Auvo real. A lógica de
// concatenação/propagação em si já foi verificada read-only contra dados reais de produção e via
// pgTAP (`pcm_localizacao_auvo_hierarquica.test.sql`) — mesmo cuidado de "não testar contra o
// caminho que grava de verdade sem sandbox" já usado em E04-S09 (Mercado Pago).
test("Configurações > Localização Auvo mostra separador/ordem e o preview", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.getByRole("navigation").getByText("Localização Auvo", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Localização Auvo" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/Preview \(Torre A/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar" })).toBeVisible();
});
