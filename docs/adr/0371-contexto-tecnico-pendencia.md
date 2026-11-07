---
name: "docs-adr-0371-contexto-tecnico-pendencia-md"
description: "Documento Sinérgica SO: ADR-0371 — Norma e condição técnica declaradas pelo PCM"
alwaysApply: false
---

# ADR-0371 — Norma e condição técnica declaradas pelo PCM

Prepara-se registro humano versionado para norma opcional e condição técnica de uma Pendência, com motivo, revisão e auditoria. Campos nulos representam informação não declarada; o texto não é extraído automaticamente de retorno, nem comprova vigência normativa, conformidade ou atendimento da condição. Histórico anterior é preservado.

Gate e execução fechados. O comando não modifica estado nem resolve Pendência. Testes de autorização, concorrência e impacto em consumidores de revisão antecedem ativação.
