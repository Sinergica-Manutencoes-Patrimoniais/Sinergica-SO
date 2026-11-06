---
name: "docs-adr-0432-auditoria-vigencias-revisao-md"
description: "Documento Sinérgica SO: ADR-0432 — Diagnóstico de versões e vigências"
alwaysApply: false
---

# ADR-0432 — Diagnóstico de versões e vigências

Status: preparado, gate desligado, não aplicado nem homologado. A consulta conta versões aprovadas, rascunhos, inícios ausentes e pares de vigências aprovadas sobrepostas, além de eventos de aprovação e de encerramento da vigência anterior encontrados na auditoria. Os dados são uma fotografia autorizada e não comprovam integridade nem cobertura da auditoria.

O comando existente 0342 prepara aprovação com lock de Plano, fechamento da vigência anterior e auditoria; 0345 protege vigências aprovadas e define constraint antissobreposição, cuja instalação depende de saneamento prévio. Esta consulta não altera rascunho ou vigências, não libera edição, não afirma impacto e não autoriza aprovação. Fuso, concorrência, testes e revisão adversarial continuam pendentes.
