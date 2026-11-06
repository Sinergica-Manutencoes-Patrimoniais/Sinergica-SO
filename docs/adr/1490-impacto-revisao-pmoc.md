---
name: "docs-adr-1490-impacto-revisao-pmoc-md"
description: "Documento Sinérgica SO: ADR-1490 — Decisões de revisão para ciclos PMOC vinculados"
alwaysApply: false
---

# ADR-1490 — Decisões de revisão para ciclos PMOC vinculados

## Contexto
Ciclos declarados com origem PMOC não geram ocorrência SSO. Revisar somente ocorrências preparadas omite esses ciclos e pode deixar agendamentos fora da análise de impactos.

## Decisão
Preparar decisões auditadas por vínculo PMOC, revisão e rascunho, com fotografia do agendamento e da decisão de mapeamento. Na aprovação, quando houver vínculos da versão anterior, exigir decisão atual e dados sem divergência; registrar uso pela nova versão somente para decisão de manter, Rotina lógica e alvo ainda presentes e vencimento na nova vigência. O histórico de origem e o agendamento PMOC não são reescritos. Revisões posteriores consultam também os usos intermediários. Decisões que exigem reconciliação continuam bloqueando a aprovação.

## Limites
O vínculo é declaração PCM, não prova independente de alvo ou contrato. Agendamentos sem vínculo não estão cobertos. Testar mudança concorrente em PMOC, revisões sucessivas, cancelamento, acesso e replay; revisar todos os consumidores e executar revisão adversarial antes de habilitar. Guarda geral de aprovação permanece bloqueada; sem deploy ou Auvo.
