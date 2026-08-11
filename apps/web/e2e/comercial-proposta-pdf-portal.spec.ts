import { expect, test } from "@playwright/test";

// E03-S06. Ciclo aprovar → gerar PDF → enviar (que publica no portal via status, sem passo à
// parte — `comercial.portal_propostas` é uma view filtrada por status). O lado do síndico (aceitar/
// recusar) exige uma sessão `cliente-sindico` separada — fora do escopo deste arquivo, coberto por
// pgTAP (`comercial_portal_proposta_rls.test.sql`) e pelo smoke test manual feito em produção
// durante a implementação (aceite/recusa/idempotência/expiração, todos confirmados).
test("Aprova proposta, gera PDF e envia — status vira 'enviada' (publica no portal)", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Comercial", { exact: true }).first().click();
  await page.getByTitle("Contas", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Oportunidade" }).first().click();
  await expect(page.getByRole("heading", { name: /Nova oportunidade/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Título").fill(`[TESTE E2E] Oportunidade PDF/portal ${Date.now()}`);
  await page.getByRole("button", { name: "Criar oportunidade" }).click();
  await expect(page.getByRole("heading", { name: /Nova oportunidade/ })).toBeHidden({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: "Propostas" }).first().click();
  await page.getByRole("button", { name: "Nova proposta" }).click();
  await expect(page.getByText(/Rascunho/).first()).toBeVisible({ timeout: 15_000 });

  // Precisa de item na composição pra avançar de rascunho (AC-1 da S04, caso de borda).
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await page.getByLabel("Descrição").last().fill("Item de teste E2E PDF/portal");
  await page
    .getByLabel(/Qtd\.|Horas/)
    .last()
    .fill("1");
  await page.getByRole("button", { name: "Salvar composição" }).click();
  await expect(page.getByRole("button", { name: "Salvar composição" })).toBeHidden({
    timeout: 15_000,
  });

  // Avança rascunho → em_revisao → aprovada.
  await page.getByRole("button", { name: "Em revisão" }).click();
  await expect(page.getByText("Em revisão").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Aprovada" }).click();
  await expect(page.getByText("Aprovada").first()).toBeVisible({ timeout: 15_000 });

  // AC-1/task 4: com versão salva, "Baixar PDF" aparece e baixa de fato (download client-side,
  // sem round-trip com o servidor).
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);

  // AC-1/AC-3, task 5: "Enviar" gera o PDF (só pra validar que não falha) e SÓ ENTÃO muda o
  // status — publica no portal (a view é status-driven, sem passo separado, sem download
  // automático aqui — quem quer o arquivo usa "Baixar PDF").
  await page.getByRole("button", { name: /Enviar \(gera PDF/ }).click();
  await expect(page.getByText("Enviada").first()).toBeVisible({ timeout: 15_000 });
});
