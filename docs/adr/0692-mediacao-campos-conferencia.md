# ADR-0692 — Mediação de edição e conferência de campos

Mediadores autenticados de edição e conferência de campos de Sistema, Componente e Localização exigem o gate da ADR-0687 e `cadastro.aprovar` para o Cliente do lote. Os núcleos revogados preservam gates próprios, snapshots, locks, revisão, confirmação, idempotência e auditoria. O retrato para conferência usa a mesma autorização e não altera dados.

Ativação depende de revisão de privilégios e segurança e testes de autorização, isolamento, concorrência e efeitos dos gates; não cria cadastro oficial nem aciona Auvo.
