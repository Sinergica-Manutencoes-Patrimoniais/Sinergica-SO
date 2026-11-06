# ADR-0699 — Mediação de correção estruturada e recuperação

Edição estruturada e correção após aprovação parcial, bem como recuperação de atualização em lote, passam por mediadores autenticados, com gate da ADR-0687 e autorização `cadastro.aprovar` do Cliente do lote. Os núcleos preservam gates, confirmação, revisão, locks, idempotência, auditoria e restrições por ator. Nenhuma alteração oficial ou chamada externa é feita pela mediação.

Ativação depende de revisão de segurança e testes de isolamento, concorrência e repetição.
