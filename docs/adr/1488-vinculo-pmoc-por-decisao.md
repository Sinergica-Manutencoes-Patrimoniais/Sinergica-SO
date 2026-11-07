---
name: "docs-adr-1488-vinculo-pmoc-por-decisao-md"
description: "Documento Sinérgica SO: ADR-1488 — Vínculo de ciclo PMOC por conferência explícita"
alwaysApply: false
---

# ADR-1488 — Vínculo de ciclo PMOC por conferência explícita

## Contexto
Agendamento PMOC possui imóvel e contrato, mas não identifica o alvo funcional do Plano. Data e Cliente não provam equivalência. O PCM já pode propor e decidir um mapeamento com evidência; a origem da Rotina é escolhida separadamente.

## Decisão
Preparar vínculo imutável entre proposta e última decisão validada pelo PCM, congelando identidade da Rotina, alvo, versão, agendamento e data. Exigir confirmação explícita do PCM sobre mesmo alvo e obrigação contratual, evidência, permissão de gestão e aprovação, origem `pmoc`, versão e agendamento atuais, além de ausência de ocorrência do Plano com a mesma identidade/data. Não criar ou cancelar agendamento, OS ou tarefa. Vínculo fica desatualizado se a última decisão ou agendamento mudar; não se declara exclusividade global apenas por essa confirmação. Gate e interface começam desligados.

## Limites
A confirmação é declaração humana auditada, não validação automática do documento nem prova de todos os geradores. Ocorrência SSO existente ou origem concorrente exige reconciliação explícita, sem exclusão automática. É necessário integrar visão e consumidores PMOC, testar corridas de criação, revogação e mudança de fonte e revisar adversarialmente antes de habilitar. Sem deploy ou Auvo real.
