# ADR-1089 — Progresso recuperável da varredura de OS

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar registro de execução, cursor, revisão e recibos imutáveis por página para a varredura de OS. Cada avanço chama a página local na mesma transação; repetição idêntica devolve o recibo anterior. Apenas serviço recebe execução da função de avanço, mantendo todos os gates fechados. Nenhuma tarefa externa é criada ou consultada e nenhum agendamento é ativado.

## Limites

Execuções iniciadas com novo identificador recomeçam do início; uma varredura por UUID não é fotografia. Falta executor autenticado, gerenciamento de agendamento, cobertura de itens transferidos, leases e demais integrações. Validar RLS/FORCE, ordem de locks, concorrência, recuperação de resposta incerta e revisão adversarial antes de qualquer liberação.
