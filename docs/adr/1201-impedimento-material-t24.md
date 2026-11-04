# ADR-1201 — Impedimento por material no início T−24

## Contexto

Uma intenção local de impedimento não interrompe tarefa já enviada nem bloqueia outros caminhos. A execução T−24 preparada tem fronteira transacional de início em 1342.

## Decisão

Preparar gate independente, inicialmente fechado, que insira uma guarda nessa fronteira. A decisão de impedimento e o início T−24 disputam trava consultiva por OS; se o último evento for suspensão, novo início é recusado. Repetição de início já registrado continua incerta, não autoriza reenvio. O gate de intenção e seus registros não são apagados.

## Limitações

Não cancela nem para efeito iniciado, não comprova suspensão no Auvo e não protege produtores ou consumidores legados. A guarda só coordena escritores participantes e exige conciliação de tarefas em voo antes de qualquer uso. Validar locks, replay, rollback, alteração de Cliente, RLS/FORCE, gateways e revisão adversarial; não habilitar isoladamente.
