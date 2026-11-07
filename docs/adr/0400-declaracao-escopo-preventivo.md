---
name: "docs-adr-0400-declaracao-escopo-preventivo-md"
description: "Documento Sinérgica SO: ADR-0400 — Declaração versionada do escopo preventivo"
alwaysApply: false
---

# ADR-0400 — Declaração versionada do escopo preventivo

Status: proposta preparada; gate desligado, sem aplicação ou homologação.

Uma declaração PCM imutável identifica uma ocorrência por calendário com vínculo legado comprovado e as OS existentes daquela ocorrência, com motivo, revisão otimista, ator e auditoria. O comando verifica Cliente e permissão, normaliza IDs e é idempotente por request. Ele não altera OS, Chamado nem ocorrência, e não chama Auvo.

A declaração é apenas uma fotografia humana: não comprova integralidade, não congela escritores legados e não autoriza concluir a ocorrência. A criação concorrente ou posterior de OS permanece possível. É necessário contrato de integralidade, proteção transacional de todos os escritores e revisão adversarial antes de usar esta fotografia para fechamento. Ocorrências por Visita não são atendidas pela ponte atual e permanecem fora do comando. Não há acesso concedido nem ativação automática.
