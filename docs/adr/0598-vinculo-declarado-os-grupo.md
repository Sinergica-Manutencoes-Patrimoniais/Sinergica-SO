---
name: "docs-adr-0598-vinculo-declarado-os-grupo-md"
description: "Documento Sinérgica SO: ADR-0598 — Vínculo declarado de OS existente a Grupo"
alwaysApply: false
---

# ADR-0598 — Vínculo declarado de OS existente a Grupo

Registro humano, auditado e imutável associa uma ocorrência de Grupo a uma OS já existente do mesmo Cliente, com motivo e permissão. Uma OS ou ocorrência só pode ter um vínculo; OS já ligada a Chamado ou ocorrência legada exige reconciliação e é recusada. O comando não altera a OS, cria tarefa, comprova execução nem substitui a origem oficial dos consumidores atuais. Gate e permissões permanecem fechados.

A declaração não impede que escritores legados alterem a OS depois do vínculo; concorrência, proteção dos consumidores e procedimentos de correção precisam ser resolvidos antes de uso operacional. Não habilitar sem testes e revisão de segurança.
