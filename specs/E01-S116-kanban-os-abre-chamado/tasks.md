---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Ordens de Serviço: clicar num item abre o Chamado

> Escopo revisado (Lucas, 2026-07-29): investigação mostrou que remover o painel de detalhe da OS
> (`DetalheOs`) removeria "Alterar status" rápido e "Expandir" (Auvo) junto — sem substituto.
> Decisão final: painel **continua igual**, só ganha um botão "Ver Chamado". Nenhuma visão
> (Kanban/Lista/Timeline/Calendário) muda comportamento de clique.

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                | Status |
|----|----------------------------------------------------------------------|----------|------------|---------------------------------|--------|
| 1  | Domínio+adapter: `OrdemServicoOperacional.chamadoId`, `chamado_id` no `COLUNAS_OS`/`mapearOrdem` | AC-1 | — | typecheck + vitest | done |
| 2  | `HomePage.tsx`: `abrirChamadoDaOs(chamadoId)` — navega `pcmView="chamados"` + token de foco (mesmo padrão de `osDeepLink`/`osIdInicialToken`) | AC-1 | 1 | typecheck | done |
| 3  | `ChamadosPage.tsx`: prop `chamadoFocoToken` — limpa `clienteFiltro` e seta `detalheAbertoId` pro chamado, ao receber um token novo | AC-1,AC-2 | 2 | typecheck + vitest | done |
| 4  | `OrdensServicoPage.tsx`/`DetalheOs`: prop `onAbrirChamado` repassada; botão "Ver Chamado" no painel (desabilitado se `chamadoId` for `null`) | AC-1 | 2,3 | typecheck + vitest | done |

## Plano de teste
- Aceite: Playwright — clicar em "Ver Chamado" no painel de detalhe (qualquer visão) navega pra
  Chamados com o chamado certo expandido; filtro de cliente ativo é limpo; OS sem `chamadoId`
  mostra o botão desabilitado — pendente teste local do Lucas.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável (typecheck/vitest/biome)
- [ ] Playwright rodado localmente (`ordens-servico.spec.ts` — confirmar que não quebrou)
- [ ] `docs/STATE.md` atualizado
