# ADR 0824 — Serializar autorização de recepção até commit

Reutilizar a trava compartilhada transacional `sso-autorizacao-confirmacao-visita`, cujo lado exclusivo protege as fontes de permissão em 0319. A recepção a obtém com `pg_try_advisory_xact_lock_shared` antes da primeira consulta de autorização e antes das travas de request e origem; se indisponível, retorna conflito explícito para repetição. A trava permanece até o commit ou rollback, inclusive no replay.

As fontes atuais de `sso_autorizar_acao` e `resolver_permissoes_modulo` são cobertas pelos triggers 0319; manter essa cobertura como pré-condição de implantação. READ COMMITTED continua obrigatório. Concessões e RPC não mudam, nem há alteração em staging já existente. A dependência de uma trava global pode gerar contenção; medir antes de liberar e não alegar cobertura de revogação de JWT externa.

Rollback: restaurar definição 1014; risco de revogação após a última rechecagem volta a existir.
