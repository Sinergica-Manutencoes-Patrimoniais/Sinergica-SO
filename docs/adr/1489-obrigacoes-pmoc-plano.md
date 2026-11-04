# ADR-1489 — Visibilidade e exclusividade local de ciclo vinculado ao PMOC

## Contexto
O vínculo declarado pelo PCM estava visível apenas dentro da proposta e não era considerado pela proteção de criação de ocorrência SSO. A ausência de vínculo visível não comprova ausência de agendamento PMOC.

## Decisão
Exibir no Plano o último vínculo por Rotina lógica, alvo e vencimento, com situação atual do agendamento e decisão; vínculos contraditórios ou desatualizados exigem revisão. Sob o gate de vínculo, impedir inserção ou alteração de identidade de ocorrência SSO por calendário ou Visita com a mesma identidade e data de qualquer vínculo PMOC histórico, inclusive desatualizado, até reconciliação explícita. Mesma trava de identidade é tomada pela criação do vínculo e pela inserção ou mudança de identidade, recusando concorrência. Não altera histórico, PMOC, OS ou tarefas.

## Limites
A proteção cobre apenas ciclos explicitamente vinculados; não comprova exclusividade global, nem integra execução ou fila. A ausência de correspondência não indica inexistência de PMOC. Testar corridas, vínculos antigos, atualizações/cancelamentos, filtros e políticas antes de habilitar; revisar todos os escritores, fuso e outras formas de identidade. Sem deploy/Auvo.
