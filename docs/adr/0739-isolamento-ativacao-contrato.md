# ADR-0739 — Isolamento explícito na ativação de contrato

**Status:** diagnóstico; sem homologação ou deploy.

O protocolo da 0961 usa a trava das fontes de permissão e revalida após bloqueios. Em duas sessões, uma ativação `REPEATABLE READ` iniciada antes da revogação manteve snapshot antigo e concluiu mesmo após a revogação ter sido confirmada. A trava não atualiza o snapshot da transação.

## Decisão

Até existir um mecanismo de autorização comprovado para outros isolamentos, a ativação só será executada em `READ COMMITTED`; `REPEATABLE READ` e `SERIALIZABLE` falham antes de qualquer efeito com `25001`. Isso é uma restrição de compatibilidade explícita, não autorização nova. A 0962 preserva assinatura, ACL, controle de custo, locks e verificações da 0961. Não altera dados existentes, dispara cobranças ou chama integrações.

Testar em banco isolado transações `READ COMMITTED` com revogação nas duas ordens, e negar antecipadamente ambos isolamentos restritos para contratos avulsos e recorrentes. Inventariar consumidores que usam outros isolamentos, revisar deadlocks, gatilhos de fontes de autorização, comportamento de usuários privilegiados e provedor de identidade; executar CI/db-tests e revisão adversarial antes de implantação. A garantia depende dos gatilhos de autorização estarem ativos e dos escritores respeitarem a mesma trava. Reversão exige migration compensatória revisada e reconhece que retirar a restrição reabre a falha.
