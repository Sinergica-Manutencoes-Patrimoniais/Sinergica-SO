---
name: "docs-adr-0325-foto-inadequada-publicacao-md"
description: "Documento Sinérgica SO: ADR-0325 — Marcação humana de foto inadequada"
alwaysApply: false
---

# ADR-0325 — Marcação humana de foto inadequada

Decisão humana versionada marca foto como `inadequada` ou `reavaliada`, com motivo, revisão e histórico imutável. `Reavaliada` apenas retira esta marcação e não comprova anonimização, segurança, ausência de malware ou autorização de publicação. A marcação inadequada bloqueia novos vínculos e resolução de leitura nos destinos Grupo e ativo, sem apagar a origem nem o vínculo histórico.

O gate de registro nasce desligado; a proteção consulta decisões já existentes independentemente do gate, para não perder eficácia ao desligá-lo. Leitura do próprio levantamento pelo PCM continua separada. Testes de concorrência, privacidade e segurança são obrigatórios antes de ativar.
