# ADR-1197 — Decisão preliminar de vencimento mediada

## Contexto

As funções de decisão e histórico 0422/0425 são privadas. A prévia de ciclos precisa permitir tratamento pelo PCM após retomada, sem gerar ou cancelar automaticamente uma obrigação.

## Decisão

Preparar entradas autenticadas que validem ator, Cliente, capacidade e gate antes de chamar os núcleos privados. O registro trava requestId e Plano na ordem do núcleo; a leitura mantém trava compartilhada do Plano. O registro mantém decisão imutável e revisão existentes; a consulta permanece paginada. A interface utiliza as entradas somente sob flag adicional desligada.

## Limitações

Os núcleos não comprovam que toda obrigação vencida foi identificada ou resolvida; a existência de retomada não prova que o ciclo pertence ao intervalo suspenso. Não aplicar ou ativar antes de validar elegibilidade, autorização, concorrência de revogação e gates, histórico, idempotência, RLS/FORCE e revisão adversarial. Não gera OS nem tarefas externas.
