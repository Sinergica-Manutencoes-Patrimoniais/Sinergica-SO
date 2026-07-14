---
name: tasks
description: Decomposição e gates — cadastro rico de ferramenta com imagem (sem Storage novo).
alwaysApply: false
---

# Tasks — E01-S65 · Cadastro rico + imagem

> Independente de S63/S64 (pode rodar em paralelo). Marcar owner no ROADMAP.
> Branch: `feat/E01-S65-ferramentas-cadastro-rico`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Testar `PATCH /products/{id}` com `imageUrl` num produto de teste reversível (credencial Auvo real) — documentar resultado nesta pasta (append ao spec.md, seção "Achado técnico") | AC-1 | credencial Auvo | manual (curl) | todo |
| 2 | Atualizar `AuvoProduct`/mapeamento em `_shared/auvo/registry/ferramentas.ts` com `imageUrl`, `uriAttachments`, `code`; `toAuvoUpdate` inclui `imageUrl` só se a task 1 confirmar escrita | AC-1, AC-2 | 1 | `pnpm run test` | todo |
| 3 | `domain/ferramentas.ts`: estender `FerramentaFormData`/`FerramentaItem` com `imagemUrl`, `codigoAuvo`, validação de URL de imagem (se editável) | AC-2, AC-3 | 2 | `pnpm run test` | todo |
| 4 | Reformular formulário em `FerramentasPage.tsx`: campos novos, preview de imagem, categoria com busca, validação inline; lista ganha thumbnail quando houver imagem | AC-2–AC-4 | 3 | `pnpm run test` | todo |
| 5 | `pnpm run ci:local` + Playwright (cadastrar com/sem imagem conforme resultado da task 1) + ROADMAP/STATE | todos | 1–4 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit: validação de URL de imagem (vazio ok, URL inválida rejeitada).
- Manual: comparar o que a task 1 confirmou contra o comportamento real da tela.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes pelo comando · `ci:local` verde · ROADMAP/STATE atualizados
- [ ] Resultado da task 1 documentado no `spec.md` (não deixar "não confirmado" pendurado)
