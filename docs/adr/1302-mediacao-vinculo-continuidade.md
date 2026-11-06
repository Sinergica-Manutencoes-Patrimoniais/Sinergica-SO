# ADR-1302 — Mediação do vínculo de continuidade do Backlog

## Contexto

A interface de continuidade chama funções privadas de consulta e vínculo.
Após a revogação dos privilégios diretos, a jornada não pode operar com
usuário autenticado mesmo quando suas autorizações e gates forem habilitados.

## Decisão

Criar entradas mediadas com ator explícito conferido contra a sessão atual.
As entradas delegam às funções existentes, que mantêm gates fechados,
autorização por Cliente, revisão, idempotência e auditoria. A interface usa
as entradas novas apenas sob flag desligada por padrão. Não enviar ao Auvo.

## Limites

Antes de liberar: validar implantação coordenada, EXECUTE e RLS/FORCE,
autorização e revogação concorrentes, isolamento de Cliente, cadeia, replay,
paginação, sessão e revisão adversarial. A mediação não comprova execução,
nem equivale a aprovar retorno parcial.
