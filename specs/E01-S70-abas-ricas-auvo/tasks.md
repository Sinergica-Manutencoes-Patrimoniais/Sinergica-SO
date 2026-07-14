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
| 1 | `pcm-auvo-tasks-import/index.ts`: interface `AuvoTask` estendida (`questionnaires`, `keyWords`/`keyWordsDescriptions`, `timeControl`, `financialCategory`) + `montarDetalhes` captura `questionarios` (achatado de `questionnaires[].answers[]` via `achatarQuestionarios`: pergunta/resposta/data), `palavrasChave`, `controleHoras`, `categoriaFinanceira`. Só chaves presentes. 5 testes Deno novos (`achatarQuestionarios`, presença/ausência, fallback keyWords) | AC-1 | — | `deno test` (CI) | **done** (Deno CLI ausente local, roda no CI) |
| 2 | `DetalhesTarefaAuvo` extraído de `OrdensServicoPage.tsx` (função interna ~150 linhas) para `components/DetalhesTarefaAuvo.tsx` — componente puro de apresentação, recebe `detalhes` + `checkInAt`/`checkOutAt` (vivem na OS, não no jsonb). Import ajustado na página | AC-2 | — | `pnpm run test` | **done** |
| 3 | Aba Questionários renderiza pergunta→resposta→data (lista, não contagem); estado vazio quando não há questionário | AC-3 | 2 | `pnpm run test` | **done** |
| 4 | Aba Anexos/Fotos: `<img>` das URLs de `anexos` (grid de thumbnails, abre original em nova aba) + `assinaturaUrl`; `onError` troca pra link "Ver anexo" se a URL não for imagem carregável (payload real de `attachments[]` não documentado — extração de URL tenta `url`/`attachmentUrl`/`fileUrl`/`link`/`uri`/`path`, a confirmar contra dado real em produção) | AC-4 | 2 | `pnpm run test` | **done** |
| 5 | 7 abas: Relato, Anexos/Fotos, Questionários, Equipamentos, Pendências, Horas, Valores (produtos/serviços/custos como LISTA via `descreverItem`, não contagem); estado vazio honesto por aba. Equipamentos fica com estado vazio fixo — tabela `pcm.os_equipamentos_auvo` (E01-S16) só é populada pelo webhook, não exposta no frontend hoje; wire real fica pra story futura se o Lucas confirmar que é prioridade | AC-5 | 2, 3, 4 | `pnpm run test` | **done** (Equipamentos: estado vazio, sem fonte de dado no frontend ainda) |
| 6 | Domain `ordens-servico.ts`: `detalhes` já é `Record<string, unknown>` (jsonb genérico, mesmo padrão desde E01-S38) — decisão consciente de NÃO criar interface estrita pra `questionarios`/`palavrasChave`/`controleHoras`; o componente de apresentação já faz o cast pontual (`QuestionarioResposta`), evita duplicar o contrato em 2 lugares toda vez que o Auvo manda campo novo | AC-1 | 1 | `pnpm run typecheck` | **done** (decisão: manter genérico) |
| 7 | Gates + ROADMAP/STATE | todos | 1-6 | `biome check --write .`, `typecheck`, `test` (296 passando), `build`, `arch:check`, `check:edge-functions`, `audit:esteira`, `eval:spec`, `validate-mermaid` | **done, todos verdes** — verificação visual em browser **não realizada** (sem Playwright neste ambiente); `questionarios` só popula em OS re-sincronizadas após deploy |

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
