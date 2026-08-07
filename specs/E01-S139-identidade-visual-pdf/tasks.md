---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Identidade visual nos PDFs de relatório

> Tier pequeno. Sem migration, sem Edge Function. Puro frontend.

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Helper `apps/web/src/lib/pdf/relatorio-pdf.ts`: `criarRelatorioPdf({ titulo, subtitulo })` com cabeçalho (faixa navy + logo + filete laranja), rodapé ("Sinérgica Manutenções" + "Página X de Y" + data) e paginação automática (`escreverTexto`/`escreverParagrafo` + `finalizar`) | AC-1,AC-2,AC-3 | typecheck | done |
| 2 | Logo carregado via `fetch` do asset público; falha de fetch degrada sem logo, não lança | Caso de borda | vitest | done |
| 3 | `RelatorioClientePage.tsx` usa o helper (título "Relatório de Atividades", subtítulo cliente+período) | AC-1,AC-4 | typecheck | done |
| 4 | `RelatorioDiarioPage.tsx` usa o helper (título "Relatório do Dia", subtítulo data) | AC-1,AC-4 | typecheck | done |
| 5 | `RelatorioPlanejamentoPage.tsx` usa o helper (título "Relatório de Planejamento", subtítulo modo+data) | AC-1,AC-4 | typecheck | done |
| 6 | Teste do helper: mock de `fetch` (PNG mínimo), cabeçalho/rodapé desenhados, paginação dispara com texto longo, `finalizar()` degrada sem logo | AC-1,AC-2,AC-3 | vitest | done |

## Plano de teste
- Unidade: `relatorio-pdf.test.ts` — bytes começam com `%PDF`, número de páginas aumenta com texto
  longo, `finalizar()` não lança quando `fetch` do logo falha.
- Visual: baixar os 3 PDFs no dev server e conferir cabeçalho/rodapé/paginação a olho (não
  automatizável em vitest).

## Divergências (SPEC_DEVIATION)
- Nenhuma.

## Checklist de Definition of Done
- [x] AC verdes pelo gate
- [ ] Conferência visual dos 3 PDFs no dev server (Lucas)
- [x] ROADMAP.md + STATE.md atualizados
