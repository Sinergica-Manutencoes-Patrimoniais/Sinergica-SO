---
name: "docs-adr-1460-upload-resposta-mediado-md"
description: "Documento Sinérgica SO: ADR 1460 — Registro mediado de upload por resposta"
alwaysApply: false
---

# ADR 1460 — Registro mediado de upload por resposta

Consulta do objeto, histórico e registro usam entradas autenticadas vinculadas a Cliente e retorno, mantendo os núcleos privados e as verificações existentes de objeto, dono, resposta e revisão. A consulta não expõe caminho de outro retorno. Nenhuma policy de Storage é alterada.

O upload direto depende de policies e permissões de Storage ainda não homologadas; validar ACL, sessão, objeto, replay, concorrência e revisão adversarial antes de habilitar.
