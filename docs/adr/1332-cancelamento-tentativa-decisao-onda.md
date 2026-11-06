# ADR-1332 — Cancelamento de tentativa de decisão de onda

Status: preparado, gate e interface desligados.

Uma tentativa incerta pode ser cancelada pelo mesmo ator autorizado ao Cliente,
sob a mesma trava do request da decisão. Se a decisão já foi registrada, a
resposta informa confirmação e não desfaz a decisão. Se ainda não foi registrada,
um registro imutável impede a chegada tardia desse request. O cancelamento é
idempotente e auditado; não libera onda nem produção e não apaga evidências.

Antes de habilitar, drenar comandos iniciados sem a guarda, validar ambas as
ordens de concorrência, replay, permissão atual, RLS/FORCE e revisão adversarial.
Rollback desliga a interface/gate, mas mantém as canceladas e a guarda para não
ressuscitar pedidos antigos. Não excluir registros de cancelamento.
