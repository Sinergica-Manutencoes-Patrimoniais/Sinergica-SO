---
name: "docs-adr-1327-reserva-envio-legado-material-md"
description: "Documento Sinérgica SO: ADR-1327 — Reserva para envio legado e impedimento de material"
alwaysApply: false
---

# ADR-1327 — Reserva para envio legado e impedimento de material

Status: preparado; não habilitar sem transição coordenada e validação.

O envio legado de OS ao Auvo pode estar em voo quando o PCM declara impedimento
por material. Antes de um novo POST, o serviço deverá reservar a OS em banco,
sob a mesma trava usada pela declaração de impedimento. Uma suspensão nova será
recusada enquanto houver reserva pendente, inclusive quando o resultado do
envio for incerto. A própria tentativa só encerra sua reserva quando o identificador
da tarefa estiver gravado na mesma OS; falha, timeout ou ausência de confirmação não
liberam nova tentativa automaticamente.
Uma repetição exata da confirmação da mesma reserva, OS e tarefa é idempotente;
qualquer divergência permanece bloqueada.
A preparação da mesma reserva também pode ser repetida antes do POST, sem
criar outro registro; uma reserva diferente para a mesma OS é recusada.

Gate de banco e flag da função iniciam desligados. O rollout exige bloquear e
drenar chamadas legadas anteriores à reserva antes de ativar ambos, e conferir
todos os outros caminhos de envio. A reserva não cancela tarefa, não prova
estado remoto e não cobre outros produtores. Recuperação de resultado incerto
exige reconciliação auditada; nunca expirar ou remover reservas por tempo.
Rollback desliga primeiro a flag, após interromper novas chamadas e tratar as
reservas pendentes; não remover os registros de auditoria. Exige teste de ambas
as ordens, falha após POST, concorrência, ACL/RLS e revisão adversarial.
