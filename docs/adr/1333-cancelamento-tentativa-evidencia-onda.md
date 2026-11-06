---
name: "docs-adr-1333-cancelamento-tentativa-evidencia-onda-md"
description: "Documento Sinérgica SO: ADR-1333 — Cancelamento de tentativa de evidência de onda"
alwaysApply: false
---

# ADR-1333 — Cancelamento de tentativa de evidência de onda

Status: preparado, gate e interface desligados.

O mesmo ator autorizado pode cancelar uma tentativa incerta sob a trava do
request de evidência. Se já foi registrada, a função informa confirmação e
preserva o histórico. Se não foi, cria registro imutável que impede chegada
tardia do mesmo request. A operação é auditada e idempotente; não cancela
evidência existente, decisão ou aceite de onda.

Antes de habilitar, drenar comandos anteriores à guarda e validar concorrência
nas duas ordens, replay, permissões, sessão, RLS/FORCE e revisão adversarial.
Rollback desliga a interface/gate, mantendo a guarda e cancelamentos para não
ressuscitar tentativas antigas.
