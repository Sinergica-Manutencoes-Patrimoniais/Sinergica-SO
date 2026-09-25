import { expect, test } from "@playwright/test";
import { softDeletePorNome } from "./helpers/limpeza-e2e";

// E01-S63: unidade individual com código próprio (valida também o fix de grant da sequence,
// migration 0093 — mesmo bug achado em pcm.inspecao_codigo_seq).
//
// E01-S146 (2026-08-12): dois achados nesta revisão —
// 1. Pollution real: este spec criava `[TESTE E2E] Ferramenta <timestamp>` sem nunca limpar — 33
//    registros acumulados em produção. `afterEach` soft-deleta a fixture desta execução (mesmo
//    padrão do botão "Excluir" de Clientes — não há DELETE físico via RLS).
// 2. Spec estava quebrado contra a UI atual: o campo "Quantidade total" não existe mais no form
//    de criação (`quantidadeTotal` some sempre em 0 na criação, nunca editável depois — só muda
//    via `gerarUnidadesFerramenta`). Criar ferramenta hoje pede um "Código / patrimônio *" e cria
//    a PRIMEIRA unidade automaticamente com esse código — o botão "Gerar unidade(s)" só aparece
//    quando `quantidadeTotal > unidades.length`, estado inatingível pelo fluxo de criação atual
//    (fica órfão/não-alcançável nesta tela; não é escopo desta story mexer nisso). Reescrito para
//    validar o fluxo real: criar com código customizado, confirmar a unidade com esse código.
// 3. **Achado real, fora de escopo**: `criarFerramenta` grava `quantidade_total: 0` e
//    `gerarUnidadesFerramenta` (chamada logo em seguida pra criar a 1ª unidade) não incrementa
//    `ferramentas.quantidade_total` — o rótulo mostra "1/0 unid." (1 unidade real, 0 "declarado")
//    em toda ferramenta nova. Não é o que Lucas pediu nesta story (poluição de dado teste); fica
//    sinalizado pra story própria se o Lucas quiser corrigir a UX.
let nomeCriado: string | null = null;

test.afterEach(async ({ page }) => {
  if (!nomeCriado) return;
  await softDeletePorNome(page, "pcm", "ferramentas", nomeCriado);
});

test("cria ferramenta e confirma unidade com código próprio gerada automaticamente", async ({
  page,
}) => {
  const nome = `[TESTE E2E] Ferramenta ${Date.now()}`;
  const codigo = `TESTE-E2E-${Date.now()}`;
  nomeCriado = nome;

  await page.goto("/");
  await page.getByText("PCM · Operação", { exact: true }).first().click();
  await page.getByText("Ferramentas", { exact: true }).click();

  await page.getByRole("button", { name: "Nova ferramenta" }).click();
  await page.getByLabel("Nome *").fill(nome);
  await page.getByLabel("Código / patrimônio *").fill(codigo);
  await page.getByRole("button", { name: "Salvar" }).click();

  // E01-S75: Ferramentas virou lista densa (linha por ferramenta, sem card) — a linha é o
  // ancestral `div.py-2.5` mais próximo do nome (só a linha tem essa classe).
  const linha = page
    .getByText(nome, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"py-2.5")][1]');
  await expect(linha).toBeVisible({ timeout: 10_000 });

  await linha.getByText(nome, { exact: true }).click();
  await expect(linha.getByText(codigo, { exact: false })).toBeVisible({ timeout: 10_000 });
});
