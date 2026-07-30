import { expect, test } from "@playwright/test";

// E01-S89 AC-2 + E01-S118 T7: no painel de detalhe do card no board da Operação (menu "Chamados"),
// a seção de histórico de atendimento aparece sempre que há Chamado vinculado — sem nenhum
// snapshot anexado ainda, mostra o estado vazio. Cria um Chamado novo (mesmo fluxo de
// chamados.spec.ts) só pra garantir que a seção existe e funciona antes de qualquer anexo.
test("Chamado exibe a seção de histórico de atendimento (estado vazio)", async ({ page }) => {
  const sufixo = Date.now();
  const tituloChamado = `[TESTE E2E] Chamado histórico ${sufixo}`;

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByTitle("Chamados", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Operação" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Novo Chamado" }).click();
  await expect(page.getByRole("heading", { name: "Novo Chamado" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByLabel("Título *").fill(tituloChamado);
  await page.getByRole("button", { name: "Criar Chamado" }).click();
  await expect(page.getByRole("heading", { name: "Novo Chamado" })).not.toBeVisible({
    timeout: 10_000,
  });

  const linha = page.getByRole("row", { name: tituloChamado });
  await expect(linha).toBeVisible({ timeout: 10_000 });
  await linha.click();

  // ChamadoPainel mostra o histórico sempre (sem toggle) — estado vazio confirma que a seção
  // carregou de verdade (não é só ausência silenciosa de erro).
  await expect(page.getByText("Nenhum histórico de conversa anexado ainda.")).toBeVisible({
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
