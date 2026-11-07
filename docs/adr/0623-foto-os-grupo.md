---
name: "docs-adr-0623-foto-os-grupo-md"
description: "Documento Sinérgica SO: ADR-0623 — Foto privada de OS associada ao atestado de Grupo"
alwaysApply: false
---

# ADR-0623 — Foto privada de OS associada ao atestado de Grupo

Comando autorizado referencia nota da OS vinculada ao atestado e objeto existente em bucket privado `os-anexos`, com mesmo Cliente e MIME declarado JPEG/PNG. A associação é revisionada, auditada e imutável; não expõe caminho de Storage. Não autentica autoria, data ou conteúdo da foto, não comprova cobertura e não encerra ocorrência. O gate permanece fechado e não são concedidas permissões.

Revisão do conteúdo e revogação de referência, download mediado, efeitos de exclusão posterior do objeto, concorrência, testes e homologação ainda são necessários. A guarda de encerramento 0841 permanece.
