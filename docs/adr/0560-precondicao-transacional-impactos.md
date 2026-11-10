---
name: "docs-adr-0560-precondicao-transacional-impactos-md"
description: "Documento Sinérgica SO: ADR-0560 — Pré-condição transacional de impactos"
alwaysApply: false
---

# ADR-0560 — Pré-condição transacional de impactos

Status: preparada, gates fechados, não aplicada nem homologada. Uma transação autorizada bloqueia o Plano e registros observados de ocorrências/OS, reavalia preflight de fuso/vigência e decisões parciais de calendário e Visita/legado, e grava fotografia imutável auditada. Não altera versão ou OS nem emite token de aprovação.

Os locks sobre linhas existentes não impedem todas as inserções concorrentes de escritores legados e fontes não relacionadas não são comprovadas. Assim mesmo contagens zeradas não configuram prova integral: proteção 0715 continua bloqueando. A autorização futura depende de fonte de completude, guarda de todos os escritores/isolamento, ordem de locks, validação temporal do fuso e decisões, testes e revisão adversarial. Não há habilitação automática.
