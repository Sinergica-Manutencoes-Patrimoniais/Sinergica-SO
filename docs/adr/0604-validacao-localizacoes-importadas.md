---
name: "docs-adr-0604-validacao-localizacoes-importadas-md"
description: "Documento Sinérgica SO: ADR-0604 — Campos de localização recebida"
alwaysApply: false
---

# ADR-0604 — Campos de localização recebida

Status: proposta; gate fechado, não homologada.

Ao registrar incorporação ou atualização de Área, Local ou Sublocal de levantamento, a guarda rejeita quantidade, código informado e demais atributos não vazios que os comandos atuais não incorporam. A transação reverte, preservando a linha no staging para correção e nova conferência. Não define que esses dados sejam inválidos em todos os contextos: apenas não são suportados pelos comandos atuais de localização.

Gate desligado mantém compatibilidade enquanto se revisam consumidores e dados legados. Validar ordem de triggers, concorrência e rollback antes de habilitar; migration não aplicada.
