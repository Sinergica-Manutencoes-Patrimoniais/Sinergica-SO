# ADR-0703 — Mediação de adequação e pertinência

Decisões e consultas de adequação e pertinência de evidências usam mediadores autenticados, com gate da ADR-0687 e autorização `cadastro.aprovar` sobre o Cliente real do anexo. Os núcleos mantêm gates, revisão, motivo, idempotência, auditoria e bloqueios de acesso próprios. A mediação não publica ou fornece caminho para arquivos.

Ativação depende de revisão de segurança e testes de isolamento, histórico, concorrência, reavaliação e efeitos no acesso privado.
