---
name: tasks
description: Decomposição e gates de E02-S41. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E02-S41 · Visão de conversa nova

## Plano

| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 0  | `design.md` aprovado pelo Lucas — decidir a cor da bolha de saída, a largura da fila e o destino do rascunho no F5 (3 questões em aberto) | AC-14 | — | revisão humana registrada no PR | todo |
| 1  | `application/portas.ts` — contrato do repositório (ator fora do parâmetro) | AC-6 | 0 | `pnpm vitest run apps/web/src/features/atendimento/application/portas.test.ts` | todo |
| 2  | RPC/`view` que devolve `pode_responder` e `versao` da conversa | AC-7, AC-8 | — | `pnpm run db:test -- pode_responder` | todo |
| 3  | Adapter Supabase implementa as portas, resolvendo o ator por `auth.uid()` | AC-6, AC-8 | 1, 2 | `pnpm vitest run apps/web/src/features/atendimento/infrastructure/supabase-atendimento-adapter.test.ts` | todo |
| 4  | `atendimento-queries.ts` — chaves, `keepPreviousData`, cancelamento, invalidação | AC-11 | 3 | `pnpm vitest run apps/web/src/features/atendimento/application/atendimento-queries.test.ts` | todo |
| 5  | `estado-do-workspace.tsx` — rascunho por conversa + `operacaoId` | AC-5, AC-9 | — | `pnpm vitest run apps/web/src/features/atendimento/interfaces/estado-do-workspace.test.tsx` | todo |
| 6  | `contador-da-fila.ts` + `preferencia-do-contexto.ts` `[P]` | AC-3, AC-10 | — | `pnpm vitest run apps/web/src/features/atendimento/interfaces/contador-da-fila.test.ts` | todo |
| 7  | `TimelineDaConversa.tsx` — render por tipo, rótulos de autor, citação, reação | AC-4 | 4 | `pnpm vitest run apps/web/src/features/atendimento/interfaces/TimelineDaConversa.test.tsx` | todo |
| 8  | `CompositorDeResposta.tsx` — texto, anexo, emoji, templates, rascunho, envio otimista | AC-5, AC-9, AC-12 | 5, 7 | `pnpm vitest run apps/web/src/features/atendimento/interfaces/CompositorDeResposta.test.tsx` | todo |
| 9  | `FilaDeConversas.tsx` — escopo, busca, contador, foto/iniciais | AC-2, AC-3 | 4, 6 | `pnpm vitest run apps/web/src/features/atendimento/interfaces/FilaDeConversas.test.tsx` | todo |
| 10 | `AcaoDeHandoff.tsx` + `AcaoDeEncerrar.tsx` — CAS, aviso de rascunho, conflito | AC-5, AC-8 | 5 | `pnpm vitest run apps/web/src/features/atendimento/interfaces/AcaoDeHandoff.test.tsx` | todo |
| 11 | `PainelDeContextoDoCliente.tsx` — dossiê, chamados, OS, tags, por papel | AC-10 | 4 | `pnpm vitest run apps/web/src/features/atendimento/interfaces/PainelDeContextoDoCliente.test.tsx` | todo |
| 12 | `PainelDaConversa.tsx` + `WorkspaceDeAtendimento.tsx` + rotas | AC-1, AC-7 | 7, 8, 10, 11 | `pnpm vitest run apps/web/src/features/atendimento/interfaces/WorkspaceDeAtendimento.test.tsx` | todo |
| 12a | Estados desenhados: fila vazia (2 formas), sem seleção, skeleton com métrica real, enviando, falha, sem permissão, conflito | AC-15 | 12 | `pnpm vitest run apps/web/src/features/atendimento/interfaces/estados.test.tsx` | todo |
| 12b | Gate de token: nenhuma cor/raio/sombra/duração hardcoded; laranja só em CTA e ativo | AC-14 | 12 | `pnpm run lint:tokens` (ou `grep -nE "#[0-9a-f]{3,6}\|bg-orange" apps/web/src/features/atendimento/interfaces` vazio) | todo |
| 12c | Contraste AA em claro e escuro + `aspect-ratio` reservado em imagem e vídeo | AC-16 | 12 | `pnpm run test:a11y -- --theme light --theme dark` | todo |
| 13 | Responsivo e movimento: 3 larguras + `prefers-reduced-motion` `[P]` | AC-1, AC-13 | 12 | `pnpm vitest run ... --filter "layout"` + Playwright em 3 viewports | todo |
| 14 | Acessibilidade: navegação por teclado, foco visível, `aria-label` `[P]` | AC-13 | 12 | `pnpm run test:a11y` (axe na rota `/atendimento`) | todo |
| 15 | Paridade funcional com `ConversaChat`: mensagem rica, templates, tags, acionar Zé, histórico, custo de IA | AC-12 | 12 | `pnpm vitest run apps/web/src/features/atendimento` + checklist no PR | todo |
| 16 | E2E Playwright: assumir, responder, devolver, encerrar, conflito de versão | AC-6, AC-8, AC-9 | 12 | `pnpm run e2e -- atendimento` | todo |
| 17 | Troca de rota: tela nova em `/atendimento`, antiga sem rota (sem apagar) | AC-1 | 16 | `pnpm run ci:local` | todo |

## Plano de teste

- **Unidade:** `contarAguardandoHumano` com as 3 situações; filtro de busca sem acento/caixa;
  `preferencia-do-contexto` com `localStorage` que lança; rascunho sobrevive à troca de conversa;
  `operacaoId` estável entre tentativas.
- **Componente:** timeline com os 9 tipos de conteúdo + citação + reação + os 4 rótulos de autor;
  anexo que falha em carregar cai para o cartão; compositor desabilitado com motivo quando
  `podeResponder=false`.
- **Integração (query):** filtro novo não é sobrescrito por resultado antigo; invalidação após cada
  escrita; retry do envio não duplica.
- **E2E:** fluxo completo em três viewports, incluindo conflito de versão em duas abas.
- **Visual:** cada estado de `design.md` tem teste de componente; gate de token roda no CI.
- **Aceite:** um teste por AC-1..AC-16.

## Divergências (SPEC_DEVIATION)

- [ ] <task # · motivo · resolução: corrigir código OU atualizar spec/ADR>

## Checklist de Definition of Done

- [ ] Todos os AC verdes **pelo gate executável**
- [ ] CI verde no PR (`gh pr checks`, `db-tests` **não pulado**)
- [ ] Paridade funcional com a tela antiga confirmada item a item no PR
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Nenhum dado de servidor fora do TanStack Query (revisão recusa `useEffect` buscando dado)
- [ ] `design.md` aprovado e as 3 questões em aberto respondidas
- [ ] Glossário atualizado
- [ ] `docs/STATE.md` atualizado via `/handoff`
