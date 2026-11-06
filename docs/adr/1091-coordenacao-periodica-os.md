# ADR-1091 — Coordenação periódica da varredura local de OS

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar coordenador privado que avança uma página por chamada, guarda execução corrente e aplica intervalo mínimo entre varreduras concluídas. Somente serviço pode chamá-lo; configuração e gates começam fechados. A função não cria cron nem chama Auvo e sua transação inclui avanço e progresso, evitando confirmar página parcial.

## Limites

Ativação depende de executor externo e agendamento autorizados e de testes de timeout, repetição, falhas, contenção, transferência de Cliente e recuperação do estado. Não comprova ausência de eventos atrás do cursor, leases ou efeito remoto. Validar privilégio de serviço, RLS/FORCE, concorrência, volume e revisão adversarial antes de implantar.
