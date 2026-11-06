---
name: "docs-adr-0702-mediacao-decisoes-evidencias-md"
description: "Documento Sinérgica SO: ADR-0702 — Mediação de decisões de evidências"
alwaysApply: false
---

# ADR-0702 — Mediação de decisões de evidências

Decisão e histórico de fotos e documentos são mediados para usuários autenticados, com gate da ADR-0687 e autorização `cadastro.aprovar` no Cliente real do anexo e lote correspondente. Os núcleos privados mantêm seus gates, locks, revisão, motivo, idempotência e auditoria. A mediação não publica arquivos nem revela caminhos.

Ativação depende de testes de isolamento, concorrência e acesso a conteúdo privado e revisão de segurança.
