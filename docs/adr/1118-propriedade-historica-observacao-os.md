---
name: "docs-adr-1118-propriedade-historica-observacao-os-md"
description: "Documento Sinérgica SO: ADR-1118 — Propriedade histórica de eventos de observação de OS"
alwaysApply: false
---

# ADR-1118 — Propriedade histórica de eventos de observação de OS

Status: proposta local, não aplicada nem homologada.

## Decisão

Vincular cada evento de observação ao Cliente da observação no momento em que é gravado. A associação é imutável e privada; consultas devem exigir posse atual da OS e devolver apenas eventos do Cliente autorizado. Ao instalar, os eventos existentes recebem o Cliente da observação existente, desde que não haja evidência de alteração anterior do proprietário da observação. Isso prepara a separação do histórico para eventual tratamento de transferência, sem transferir registros ou resolver conflitos.

## Limites

A propriedade histórica não comprova que a transferência da OS foi válida. A migration deve falhar se encontrar eventos sem observação ou evidência de mudança do Cliente observado. Uma decisão de transferência exigirá comando próprio, auditoria e atualização segura da observação corrente; não mover o histórico. Testar bloqueios, preenchimento legado, todas as inserções, isolamento, FORCE RLS, concorrência de transferência e revisão adversarial antes de ativar qualquer fluxo.
