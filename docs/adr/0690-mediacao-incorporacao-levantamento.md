---
name: "docs-adr-0690-mediacao-incorporacao-levantamento-md"
description: "Documento Sinérgica SO: ADR-0690 — Mediação de incorporação de levantamento"
alwaysApply: false
---

# ADR-0690 — Mediação de incorporação de levantamento

Os comandos de aplicação dos campos e criação selecionada por lote recebem mediadores autenticados, sujeitos ao gate desligado da ADR-0687 e à autorização `cadastro.aprovar` por Cliente. Os núcleos permanecem revogados e conservam gates, locks, revisão, confirmação, idempotência e auditoria na mesma transação. A mediação não suprime nem altera integrações externas e não utiliza credencial privilegiada no navegador.

A ativação requer revisão de segurança, privilégios e testes transacionais, incluindo supressão efetiva de sincronização externa. Outras consultas e comandos não são abrangidos.
