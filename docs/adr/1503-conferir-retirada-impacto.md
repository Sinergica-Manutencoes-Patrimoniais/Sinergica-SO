---
name: "docs-adr-1503-conferir-retirada-impacto-md"
description: "Documento Sinérgica SO: ADR-1503 — Confirmar retirada efetiva ao resolver impacto"
alwaysApply: false
---

# ADR-1503 — Confirmar retirada efetiva ao resolver impacto

## Contexto
A resolução `retirar_geracao` foi criada para cessar a geração futura de um escopo retirado, preservando ocorrências e OS. Uma decisão `exige_reconciliacao` também pode surgir quando a mesma Rotina e alvo continuam no rascunho com outra regra; tratar automaticamente esses casos como retirada esconderia pendência de revisão.

## Decisão
Antes de registrar resolução, verificar sob bloqueio que a combinação da identidade lógica da Rotina com o tipo e ID do alvo da ocorrência não consta no rascunho do mesmo Plano/Cliente. A mesma conferência deve ocorrer na avaliação de pendências e antes do selo transacional de aprovação; ausência de ocorrência ou de vínculo válido falha de forma fechada. A referência é a identidade específica, pois Rotinas independentes podem compartilhar um alvo. A conferência não implica que mudança de alvo ou regra esteja reconciliada de forma geral.

## Consequências
Resolução de escopo ainda presente deve permanecer pendente para tratamento específico; dados, OS e ocorrências históricas não são alterados. A verificação usa trava de tabela em escrita/aprovação e falha imediatamente em concorrência. A guarda independente 1045 e os gates existentes permanecem inalterados. Dados registrados anteriormente precisam de reavaliação; esta decisão não homologa a aprovação de revisões.
