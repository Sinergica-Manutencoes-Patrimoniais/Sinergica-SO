---
name: tasks
description: Decomposição e gates — capturar e exibir todas as abas ricas da tarefa Auvo no PCM.
alwaysApply: false
---

# Tasks — E01-S70 · Detalhe completo da tarefa Auvo

> Marcar owner no ROADMAP. Branch: `feat/E01-S70-abas-ricas-auvo`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | `pcm-auvo-tasks-import/index.ts`: estender interface `AuvoTask` + `montarDetalhes` para capturar `questionarios` (de `questionnaires[].answers[]`: pergunta/resposta/replyDate), `palavrasChave` (`keyWords`/`keyWordsDescriptions`), `controleHoras` (`timeControl`), `categoriaFinanceira` (`financialCategory`). Só chaves presentes. Testes Deno de `montarDetalhes` | AC-1 | — | `deno test` (CI) | todo |
| 2 | Extrair `DetalhesTarefaAuvo` de `OrdensServicoPage.tsx:729-878` para `components/DetalhesTarefaAuvo.tsx` (componente puro de apresentação, recebe `detalhes`). Ajustar import na página | AC-2 | — | `pnpm run test` | todo |
| 3 | No componente extraído: aba Questionários renderiza pergunta→resposta→data (não contagem) | AC-3 | 2 | `pnpm run test` | todo |
| 4 | Aba Anexos/Fotos: renderizar `<img>` das URLs de `anexos` + `assinaturaUrl` (thumbnail + lightbox/abrir maior); fallback pra link se não for imagem | AC-4 | 2 | `pnpm run test` | todo |
| 5 | Organizar em abas: Relato, Anexos/Fotos, Questionários, Equipamentos, Pendências, Horas, Valores (produtos/serviços/custos como LISTA, não contagem); estado vazio honesto por aba | AC-5 | 2, 3, 4 | `pnpm run test` | todo |
| 6 | Domain `ordens-servico.ts`: tipar as novas chaves de `detalhes` (questionarios, palavrasChave, controleHoras) | AC-1 | 1 | `pnpm run typecheck` | todo |
| 7 | `pnpm run ci:local` + Playwright (abrir OS com questionário → ver respostas; ver fotos) + ROADMAP/STATE. Re-sync (ou aguardar cron) para popular `questionarios` nas OS existentes | todos | 1-6 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit Deno: `montarDetalhes` com payload real (questionnaires presente/ausente).
- Unit web: componente renderiza questionário/fotos a partir de `detalhes` fixture.
- Playwright: OS com questionário mostra pergunta/resposta; fotos aparecem.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes · `ci:local` verde · Deno no CI · revisão adversarial (aba sem dado = vazio
  honesto; URL de anexo não-imagem não quebra) · ROADMAP/STATE atualizados
- [ ] Nota: `questionarios` só popula em OS re-sincronizadas após o deploy (dado novo em auvo_detalhes)
