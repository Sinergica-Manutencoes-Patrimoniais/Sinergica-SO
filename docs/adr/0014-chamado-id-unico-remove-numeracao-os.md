---
name: adr-0014-chamado-id-unico-remove-numeracao-os
description: Chamado (CH-XXXX) é o ID único de ponta a ponta; OS não gera numeração própria. Substitui o racional de numeração de OS de E01-S88.
alwaysApply: false
---

# ADR-0014 — Chamado (CH-XXXX) é o ID único; OS não gera numeração própria

> **ADRs são imutáveis.** Este ADR **substitui o racional de numeração de OS** estabelecido em
> E01-S88 (sequence `pcm.fn_proximo_numero_os`, prefixo `OS-`).

**Status:** Proposto
**Data:** 2026-07-28
**Decisores:** Lucas Azevedo, Fabrício Medeiros, @architect
**Relacionados:** E01-S99 (spec/design/product), E01-S88 (chamados-entidade), ADR-0001
(PCM origin truth / external id), ADR-0010 (Hub de OS estende `pcm.ordens_servico`)

## Contexto
E01-S88 criou o Chamado (`CH-XXXX`) e uma sequence dedicada (`fn_proximo_numero_os`,
`fn_proximos_numeros_os`) para numerar a Ordem de Serviço como `OS-XXXX`. Na reunião de negócio de
2026-07-27, o Fabrício definiu que a OS **não deve ter identificador próprio**: o Chamado é o número
de ponta a ponta e "virar OS" é apenas uma fase da mesma jornada (definida por ter data + técnico).
Dois números para a mesma jornada geram confusão operacional e rastreio dividido entre PCM e Auvo.

## Decisão
- O **Chamado (`CH-XXXX`) é o único identificador humano** da jornada solicitação → execução.
- A **OS não gera `OS-XXXX`**. A entidade `pcm.ordens_servico` continua existindo (UUID interno,
  conforme ADR-0010), mas **herda e exibe o `CH-XXXX`** do Chamado de origem, referenciado por
  `chamado_id`. "Virou OS" segue representado por `chamados.status = "convertido_os"` +
  `ordemServicoId`.
- A sequence/RPCs de numeração de OS (`fn_proximo_numero_os`, `fn_proximos_numeros_os`) são
  **descontinuadas**.
- No **Auvo**, a task recebe o `CH-XXXX` no campo **código externo** (reforça ADR-0001: PCM é origin
  of truth, o external id conecta ao Auvo). Pull/webhook resolvem a OS local por `chamado_id`.

## Alternativas consideradas
| Alternativa                                        | Prós | Contras | Por que (não) escolhida |
|----------------------------------------------------|------|---------|-------------------------|
| A (escolhida) OS herda `CH-XXXX`, sem número próprio | 1 ID ponta a ponta; alinhado ao negócio; Auvo mais simples | reverte S88; mexe em UI/Auvo | é o pedido explícito do dono |
| B Manter `OS-XXXX` ligado ao chamado               | menos código | mantém 2 números — não resolve | rejeitada |
| C Sequence gera `CH-` também na OS                  | reaproveita sequence | dois `CH` distintos confundem | rejeitada |

## Consequências
**Positivas:**
- Rastreio único ponta a ponta; mental model do operador respeitado.
- Integração Auvo simplificada (external id = `CH-XXXX`).
- Elimina a race/complexidade de uma segunda sequence de numeração.

**Negativas / trade-offs aceitos:**
- Retrabalho sobre código recém-entregue em E01-S88.
- Se as migrations de E01-S88 já tiverem rodado em produção, é necessário plano de dados para OS já
  numeradas (questão em aberto rastreada em E01-S99/design.md).
- OS importada do Auvo sem Chamado de origem exige regra de identificador (questão em aberto).
