---
name: spec-E01-S82-priorizacao-gutd
description: Contrato — priorização GUTD (4º fator "Dor do cliente") com peso configurável por letra somando 100%, estende E01-S01.
alwaysApply: true
tier: pequeno
---

# Spec — Priorização GUTD (Gravidade · Urgência · Tendência · Dor do cliente)

> **Fonte da verdade.** Status: aprovado
> Origem: reunião Lucas × Fabrício (2026-07-16). "Seria um GUTD... a dor do cliente... vou deixar
> configurável, vocês colocam o peso e distribui 100%, e se quiser trocar, troca."
> **Decisão do PO (2026-07-20):** cada letra recebe seu próprio peso (não bloco GUT + bloco D); os
> pesos somam 100% e são configuráveis pelo Fabrício na config do superadmin.

## Resumo
A matriz GUT (Gravidade, Urgência, Tendência) ganha um 4º fator **D = Dor do cliente** (escala 1-5,
igual às demais). A prioridade deixa de ser o produto G×U×T e passa a ser uma **média ponderada
configurável**: `prioridade = wG·G + wU·U + wT·T + wD·D`, onde os pesos `wG+wU+wT+wD = 100%` e são
editáveis na config do SO.

## Contexto atual (AS-IS)
- Domínio da priorização em `apps/web/src/features/pcm/domain/priorizacao-backlog.ts` (+ teste);
  `GUT_OPCOES` no domínio de ordens de serviço.
- Backlog GUT em `BacklogGutPage.tsx`; spec original E01-S01 (`specs/0001-priorizacao-backlog-gut/`).

## Critérios de aceite

### AC-1: Campo "Dor do cliente" (D) na OS/backlog
- **Dado** o form de OS/item de backlog
- **Quando** o usuário preenche a priorização
- **Então** há 4 campos (G, U, T, D), cada um escala 1-5, todos obrigatórios para calcular
  prioridade; D tem o mesmo peso de opção que os demais.

### AC-2: Cálculo por média ponderada configurável
- **Dado** pesos configurados `wG, wU, wT, wD` (somando 100%)
- **Quando** uma OS/item tem valores G,U,T,D
- **Então** `prioridade = wG·G + wU·U + wT·T + wD·D` (função pura no domínio, nunca gravada — sempre
  recalculada em runtime, mesmo princípio do Hub de OS E01-S07). A ordenação do backlog/hub usa esse
  valor.

### AC-3: Config de pesos (superadmin)
- **Dado** um `superadmin` em Configurações → Priorização
- **Quando** ajusta os 4 pesos
- **Então** o sistema **valida que somam 100%** (bloqueia salvar se não somam) e persiste; a mudança
  reflete imediatamente na ordenação (sem recalcular nada gravado). Valor default: 25/25/25/25 ou
  50/50 entre bloco — **default inicial GUT/D a confirmar com Fabrício; usar pesos iguais como
  fallback seguro**.

### AC-4: Retrocompat com itens só-GUT
- **Dado** OS/itens antigos sem D preenchido
- **Quando** entram no cálculo
- **Então** D é tratado como neutro (documentar: D ausente ⇒ não penaliza nem infla artificialmente;
  ex.: D=0 com peso aplicado, ou exigir preenchimento em edição). Comportamento definido no domínio e
  coberto por teste.

## Matriz de decisão
| wG | wU | wT | wD | G | U | T | D | Prioridade | AC |
|----|----|----|----|---|---|---|---|------------|----|
| 25 | 25 | 25 | 25 | 5 | 5 | 5 | 1 | 4.0        | AC-2 |
| 50 | 0  | 0  | 50 | 4 | 1 | 1 | 5 | 4.5        | AC-2 |
| soma ≠ 100 | — | — | — | — | — | — | — | salvar bloqueado | AC-3 |

## Fora de escopo (vinculante)
- Peso por cliente/contrato (decisão: peso é **global**).
- Priorização por IA.
- Reescrever a UI do backlog além de incluir o campo D e reordenar.

## Rastreabilidade
- `apps/web/src/features/pcm/domain/priorizacao-backlog.ts` (+ `.test.ts`) — fórmula ponderada + D
- `apps/web/src/features/pcm/domain/ordens-servico.ts` — `GUT_OPCOES` → incluir D
- `apps/web/src/features/pcm/pages/BacklogGutPage.tsx`, `NovaOrdemServicoModal.tsx`
- Config de pesos: `apps/web/src/features/config/pages/` (nova seção Priorização) + `config.*`
- Spec original: `specs/0001-priorizacao-backlog-gut/spec.md`
