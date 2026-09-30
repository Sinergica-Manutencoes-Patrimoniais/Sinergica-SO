---
name: tasks-E01-S161
description: Tasks da E01-S161 — lib/sheetjs compartilhado, domínio de parse/plano/exportação, execução sequencial via casos de uso, modal de importação na Estrutura.
alwaysApply: false
---

# Tasks — E01-S161 Importação/exportação da estrutura via Excel

> Commits: `feat(E01-S161): ...`. Paths relativos a `apps/web/src/`.
> O domínio é **puro**: recebe matrizes (`unknown[][]`) e o estado atual, e devolve plano/planilha.
> SheetJS só aparece em `lib/` e no componente.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **`lib/sheetjs.ts`**: mova `carregarSheetJs`/`carregarScript` de `features/pcm/pages/InspecoesPage.tsx` (~L2580–L2615) e amplie o tipo com `utils.aoa_to_sheet(rows)`, `utils.book_new()`, `utils.book_append_sheet(wb, ws, nome)` e `writeFile(wb, nomeArquivo)`. Exporte `lerPlanilha(file: File): Promise<Record<string, unknown[][]>>` e `baixarPlanilha(abas: Record<string, unknown[][]>, nomeArquivo: string)`. `InspecoesPage` passa a importar de `lib/sheetjs`. | AC-1, AC-6 | — | typecheck + `pnpm --filter @sinergica/web run test:e2e inspecao` (regressão do import de inspeção, se houver spec; senão teste manual registrado no PR) | todo |
| 2 | **Domínio: modelo e exportação** `features/pcm/domain/importacao-estrutura.ts`: tipos `EstadoEstrutura` (áreas, locais, sistemas, componentes, membros, categorias, tiposLocal, cliente), `CABECALHOS` (constante com o layout da spec), `montarPlanilhaEstrutura(estado) → Record<aba, unknown[][]>` (Leia-me com as regras da spec, Listas, Locais por profundidade), `nomeArquivoExportacao(cliente, hoje)`. Testes: cabeçalhos exatos; Local filho depois do pai; caminho `A > B` correto. | AC-1 | — | `vitest run src/features/pcm/domain/importacao-estrutura.test.ts` | todo |
| 3 | **Domínio: parse** `parsearPlanilhaEstrutura(abas) → { linhas: LinhaPlanilha[]; errosGerais: string[] }` (valida abas e cabeçalhos com normalização; ignora linhas sem Ação; guarda nº da linha real = índice + 1). Testes: cabeçalho com acento/caixa diferente aceito; aba faltando → erro geral; linha vazia ignorada. | AC-3, AC-4 | 2 | mesmo gate | todo |
| 4 | **Domínio: plano** `planejarImportacao(linhas, estado) → PlanoImportacao` (puro): resolve referências considerando o que a própria planilha cria/exclui, gera `EDITAR` com diff `campo: antes → depois`, `SEM MUDANÇA`, todos os ERROS e AVISOS da tabela do AC-4 (**mensagens literais**), siglas automáticas (`sugerirSiglaUnica` com irmãos do banco + planilha), prévia de identificador (`montarPrefixoIdentificador`), e a **ordem de execução** do AC-5 com dependências (`dependeDe: número da linha[]`). Testes: um caso por linha da tabela de erros/avisos + AC-2 (reexportado sem mudança → 0 alterações) + Local criado com pai criado na mesma planilha + ordem de execução. | AC-2, AC-3, AC-4, AC-5 | 3 | mesmo gate | todo |
| 5 | **Application** `features/pcm/application/importacao-estrutura.ts`: `carregarEstadoEstrutura(gateways, clienteId)` e `executarPlanoImportacao(gateways, plano, userId, onProgresso)`: laço **sequencial** (`for ... await`) chamando os casos de uso existentes (lista no AC-5); guarda os ids criados para resolver dependências (ex.: `localId` de um pai criado); marca `FALHOU`/`PULADA` conforme o AC-5. Testes com gateways fake: ordem das chamadas; falha isolada; dependente pulado; nunca chama em paralelo (assert com contador de chamadas em voo). | AC-5 | 4 | `vitest run src/features/pcm/application/importacao-estrutura.test.ts` | todo |
| 6 | **UI** `features/pcm/components/ImportacaoEstruturaModal.tsx`: passos (1) escolher arquivo → (2) simulação (tabelas por aba, resumo, "Executar" desabilitado com erro ou sem alteração) → (3) `ConfirmDialog` com o texto do AC-5 → (4) progresso `k de N` → (5) relatório + "Baixar relatório". Em `pages/EstruturaClientePage.tsx`: botões "Exportar Excel" (sempre) e "Importar Excel" (só com `pcm:escrita`). No fim da execução, invalidar `ativosClienteQueryKeys` do cliente. | AC-1, AC-3, AC-5, AC-6 | 1, 5 | typecheck + `pnpm run ci:local` | todo |
| 7 | **Planilha de exemplo**: confira que `specs/E01-S161-importacao-excel-estrutura/exemplo-planilha.xlsx` bate com o layout final. Se mudar coluna, regere o arquivo. | AC-1 | 2 | abrir o arquivo e comparar cabeçalhos | todo |
| 8 | **E2E** `apps/web/e2e/importacao-estrutura.spec.ts` (cliente de teste): exporta; importa de volta → 0 alterações; importa uma planilha fixture (`apps/web/e2e/fixtures/estrutura-import.xlsx`, gerada no próprio teste via SheetJS no Node ou commitada) com 1 Área, 1 Local e 1 Componente CRIAR → simulação mostra 3 CRIAR → executa → relatório OK → Componente aparece na aba Componentes. Fixture com erro → "Executar" desabilitado. Cleanup via `limpeza-e2e.ts`. | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 | 6 | `pnpm --filter @sinergica/web run test:e2e importacao-estrutura` | todo |

## Plano de teste
- Unidade: exportação, parse, plano (tabela de erros inteira), execução com fakes.
- Aceite: E2E (task 8).

## Divergências (SPEC_DEVIATION)
- [ ] (vazio)

## Checklist de Definition of Done
- [ ] AC-1..AC-6 verdes · `ci:local` · E2E verde
- [ ] Planilha de exemplo atualizada
- [ ] ROADMAP · STATE
