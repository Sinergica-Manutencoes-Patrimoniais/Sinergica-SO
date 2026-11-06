# ADR-1389 — Cópia de Plano por entrada mediada

## Decisão

A interface chama entrada autenticada específica para copiar fotografia aprovada em rascunho do mesmo Cliente. A entrada exige `plano.gerir`, identidade esperada, isolamento READ COMMITTED e os gates próprios de mediação e cópia. O núcleo idempotente permanece privado e os gates começam fechados.

Fotografias com natureza técnica explícita exigem também o gate de preservação dessa natureza. Sem ele, a cópia falha fechada em vez de perder silenciosamente a classificação. O comando não cria ocorrências, OS ou tarefas. Questionários ainda exigem conferência antes de aprovação.

## Consequências e validação

Nenhum gate deve ser habilitado antes de aplicação coordenada, testes integrados e revisão adversarial. Validar RLS/FORCE, autorização e revogação, replay, concorrência de edição e aprovação, rollback, dados legados, cópia de natureza e compatibilidade dos questionários. Não representa biblioteca compartilhada ou transferência entre Clientes.
