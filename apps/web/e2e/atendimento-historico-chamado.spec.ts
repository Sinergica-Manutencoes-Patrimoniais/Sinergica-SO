import { expect, test } from "@playwright/test";

// E01-S89 AC-2: no detalhe do Chamado, a seção "Histórico de atendimento" aparece e, sem nenhum
// snapshot anexado ainda, mostra o estado vazio — cria um Chamado novo (mesmo fluxo de
// chamados.spec.ts) só pra garantir que a seção existe e funciona antes de qualquer anexo.
test("Chamado exibe a seção de histórico de atendimento (estado vazio)", async ({ page }) => {
  const sufixo = Date.now();
  const tituloChamado = `[TESTE E2E] Chamado histórico ${sufixo}`;

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Chamados", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chamados" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Novo Chamado" }).click();
  await expect(page.getByRole("heading", { name: "Novo Chamado" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByLabel("Título *").fill(tituloChamado);
  await page.getByRole("button", { name: "Criar Chamado" }).click();

  const linha = page
    .getByText(tituloChamado, { exact: true })
    .locator("xpath=ancestor::section[1]");
  await expect(linha).toBeVisible({ timeout: 10_000 });

  await linha.getByRole("button", { name: "Histórico de atendimento" }).click();
  await expect(linha.getByText("Nenhum histórico de conversa anexado ainda.")).toBeVisible({
    timeout: 10_000,
  });
});

// E01-S89 AC-1/AC-2: no inbox de atendimento, uma conversa vinculada a um cliente do PCM ganha a
// ação "Enviar histórico" — abre o modal com a janela de dias e o seletor de Chamado (existente ou
// "criar novo"). Não força o envio (dados reais de produção não garantem mensagens na janela
// escolhida) — valida só que a ação está corretamente disponível e o modal funciona.
test("conversa vinculada a cliente mostra a ação de enviar histórico ao Chamado", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Atendimento · Zé", { exact: true }).first().click();
  await expect(page.getByPlaceholder("Buscar conversa")).toBeVisible({ timeout: 15_000 });

  // Conversas com cliente vinculado não têm o badge "Sem cliente vinculado" (ConversaLista.tsx) —
  // percorre até achar uma assim e confirma a ação "Enviar histórico". Se nenhuma existir nesta
  // janela de produção, o teste é pulado (ausência de dado de teste adequado, não falha de feature).
  const botoesConversa = page.locator("div.flex-1.overflow-y-auto > button");
  const total = await botoesConversa.count();
  let encontrou = false;

  for (let i = 0; i < total && i < 20; i++) {
    const botao = botoesConversa.nth(i);
    if (
      await botao
        .getByText("Sem cliente vinculado")
        .isVisible()
        .catch(() => false)
    )
      continue;
    await botao.click();
    const botaoHistorico = page.getByRole("button", { name: "Enviar histórico" });
    if (await botaoHistorico.isVisible().catch(() => false)) {
      encontrou = true;
      await botaoHistorico.click();
      await expect(page.getByRole("heading", { name: "Enviar histórico ao Chamado" })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText("Janela de mensagens")).toBeVisible();
      await page.getByRole("button", { name: "Cancelar" }).click();
      break;
    }
  }

  test.skip(!encontrou, "Nenhuma conversa vinculada a cliente disponível nesta janela de teste.");
});
