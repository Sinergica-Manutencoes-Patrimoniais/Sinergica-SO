---
name: "docs-adr-1020-decisao-feriado-mediada-md"
description: "Documento Sinérgica SO: ADR-1020 — Decisão mediada de feriado declarado"
alwaysApply: false
---

# ADR-1020 — Decisão mediada de feriado declarado

Status: preparação privada, não homologada.

Preparar entrada para declaração ou retirada que vincula a tentativa ao ator e Cliente esperados, mantém travas de autorização e gates e delega ao comando auditado e idempotente existente. O núcleo permanece privado. A tela seleciona o contrato novo somente por flag desligada; não há abertura operacional nesta etapa.

O comando não comprova que a data é feriado oficial e não coordena, por si só, geração ou reprogramação de Visitas. Verificar fontes de autorização, FORCE RLS, replay, conflitos de lock, operações concorrentes com fotografia/materialização e efeitos legados antes de concessão. Revisão adversarial e testes integrados são obrigatórios.
