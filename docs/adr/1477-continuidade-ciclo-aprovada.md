---
name: "docs-adr-1477-continuidade-ciclo-aprovada-md"
description: "Documento Sinérgica SO: ADR-1477 — Continuidade de ciclo vinculada à aprovação da revisão"
alwaysApply: false
---

# ADR-1477 — Continuidade de ciclo vinculada à aprovação da revisão

## Contexto
Na mudança de âncora ou regra, a mesma data pode pertencer a séries distintas. O gerador atual bloqueia a coincidência, mesmo quando o PCM decidiu manter a ocorrência anterior. Reutilizar por data isolada não comprova identidade nem autorização.

## Decisão
Preparar registro imutável, na mesma transação da aprovação, de decisões de calendário `manter_sem_alterar` cujas fotografias e avaliações parciais ainda coincidam. O registro referencia a versão aprovada, ocorrência original e decisão. O gerador poderá reutilizar o ciclo anterior em coincidência de regra apenas com esse registro e mesma Rotina lógica, alvo, Plano e vencimento, preservando ocorrência, OS, questionário e identidade canônica. O mesmo ciclo e versão continuam únicos na tabela de uso existente. Componente é opt-in e fechado por padrão; nenhum registro é criado se a aprovação reverter.

## Limites
A captura não prova integralidade de todas as fontes, PMOC ou legado e não libera a guarda independente de aprovação. A execução exige protocolo global e gates existentes. Testar aprovação completa, duas sessões, mudanças concorrentes, replays, datas coincidentes de regras diferentes, efeitos por Grupo e consumidores que assumem regra de origem, além de revisão adversarial antes de habilitar. Não altera dados históricos nem aciona Auvo.
