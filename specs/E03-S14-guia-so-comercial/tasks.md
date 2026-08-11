---
name: tasks
description: Decomposição e gates — Guia do SO passa a documentar o módulo Comercial real.
alwaysApply: false
---

# Tasks — E03-S14 · Guia do SO: módulo Comercial

> Antes de codar: marcar owner no `docs/epics/ROADMAP.md` (E03).
> Branch: `feat/E03-S14-guia-so-comercial`.
> **Última story do épico** — só faz sentido depois das telas existirem. Documentar tela que ainda
> não foi entregue é pior do que não documentar.

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Levantar a navegação **real** do módulo Comercial na sidebar (`HomePage.tsx`) — a lista de opções do guia sai daí, não do `product.md`. Anotar aqui quais stories foram entregues e quais não | AC-2 | — | leitura + anotação nesta tabela | done — `COMERCIAL_NAV` (HomePage.tsx): Dashboard (S08), Funil (S02), Contas (S01/S03), Contratos (S07), Precificação (S03), Configuração do funil (S02) — as 6 entregues; Propostas/Levantamento são sub-telas dentro de Contas (S04/S05/S06), documentadas também |
| 2 | Criar `apps/web/src/features/guia/ComercialGuia.tsx` no padrão de `FinanceiroGuia.tsx`: grupos com `titulo`/`sentido` e opções com `nome`/`paraQueServe`/`comoUsar`/`resultado`/`atencao` | AC-1, AC-2 | 1 | `pnpm run test` | done |
| 3 | Remover `ComercialGuia` de `PlanejadosGuia.tsx` e apontar o import de `GuiaRouter.tsx` para o arquivo novo | AC-1 | 2 | `pnpm run test` | done |
| 4 | `Callout` de conceitos: **Conta** (lead/prospecto/ativo/antigo é o mesmo cadastro), **Proposta × Orçamento de Serviço**, **Piso e desconto máximo**, **etapas configuráveis e motivo de perda obrigatório** — em linguagem de negócio, sem citar tabela | AC-4 | 2 | `pnpm run test` | done |
| 5 | `Callout` de integrações do ponto de vista do usuário: WhatsApp → funil, levantamento reusando a inspeção do PCM, aprovação no portal do síndico, contrato → receita recorrente | AC-6 | 2 | `pnpm run test` | done |
| 6 | Seção honesta do que **não** existe: DOCX, assinatura eletrônica, proposta gerada por IA | AC-7 | 2 | `pnpm run test` | done |
| 7 | `ComercialGuia.test.ts` no padrão de `FinanceiroGuia.test.ts`: lista as opções da navegação e exige `nome: "<opção>"` no arquivo do guia — é o gate que impede o guia de envelhecer | AC-3 | 2 | `pnpm run test` | done |
| 8 | `VisaoGeralGuia.tsx`: mover o Comercial da lista de "planejados" para a de módulos com dados reais (Callout "O que já está em uso") | AC-5 | 3 | `pnpm run test` | done |
| 9 | `AtendimentoGuia.tsx` (~L52): conferir e atualizar a menção a "o lead vai para o módulo Comercial" para o comportamento real entregue pela S09 | AC-7 | 3 | `pnpm run test` | done |
| 10 | `StatusModulo` do Comercial: de planejado para em uso (componente já existe em `GuiaUi.tsx`) | AC-1, AC-5 | 2 | `pnpm run test` | done |
| 11 | `pnpm run ci:local` + Playwright (dev server local): abrir o Guia → Comercial, conferir que rende sem erro e que a visão geral não chama mais o módulo de planejado + ROADMAP/STATE | todos | 1–10 | `pnpm run ci:local` | done — Playwright novo (`guia-comercial.spec.ts`) passou de verdade contra dev server local |

## Plano de teste
- **`ComercialGuia.test.ts` (task 7) é o gate que importa**: sem ele, a próxima tela do Comercial
  entra sem documentação e ninguém percebe. Foi assim que o Financeiro se manteve documentado.
- **Playwright**: renderizar a página do guia — é conteúdo estático, mas erro de import quebra a
  rota inteira.

## Riscos
| Risco | Mitigação |
|-------|-----------|
| Documentar tela que não foi entregue | Task 1 levanta a navegação real, não o PRD |
| Guia envelhecer na próxima story | Task 7 (teste de cobertura das opções) |
| Sobrar referência ao Comercial como "planejado" | Tasks 8, 9 e 10 varrem visão geral, atendimento e status |

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate
- [x] `pnpm run ci:local` verde · Playwright rodado contra dev server local
- [x] Nenhuma referência restante ao Comercial como módulo planejado
- [x] ROADMAP/STATE atualizados
