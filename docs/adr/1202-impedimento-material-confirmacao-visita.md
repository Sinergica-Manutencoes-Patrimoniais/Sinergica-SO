# ADR-1202 — Impedimento de material na confirmação da Visita

## Contexto

Uma Visita pode reunir várias OS; confirmar uma composição que contém OS com impedimento declarado pode induzir programação inadequada. O registro local não comprova que tarefas remotas estejam paradas.

## Decisão

Preparar guarda, sob gate independente desligado, na transição para Visita confirmada. Para cada vínculo vigente da composição, adquirir trava não bloqueante por OS na ordem de identificadores e recusar confirmação se o último evento do impedimento for suspensão. O operador deve revisar a composição ou registrar retomada conforme o fluxo; não cancelar Visita ou alterar OS automaticamente.

## Limitações

Bloqueio de confirmação é parcial: não cobre outros caminhos, etapas posteriores, alterações em voo ou tarefa Auvo. Testar consistência de vínculos concorrentes, locks, revogação, rollback e comportamento de Visita com várias OS; revisar arquitetura antes de habilitar. A guarda não transforma declaração em prova de suspensão remota.
