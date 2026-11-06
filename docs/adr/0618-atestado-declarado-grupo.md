---
name: "docs-adr-0618-atestado-declarado-grupo-md"
description: "Documento Sinérgica SO: ADR-0618 — Atestado declarado de execução para Grupo"
alwaysApply: false
---

# ADR-0618 — Atestado declarado de execução para Grupo

PCM pode registrar declaração revisionada e referência de evidência para a mesma ocorrência Grupo, intenção, decisão e OS vinculada. A Rotina e a quantidade históricas são preservadas; o comando é autorizado, auditado e idempotente. A referência é texto declarado: não comprova existência, procedência, conteúdo nem cobertura, e não autoriza encerramento automático. O gate começa desligado e não há concessões.

A associação declarada não substitui evidência autenticada ou validação transacional da execução. Escritores concorrentes de OS e vínculo, política de evidências, revisão, testes e homologação seguem pendentes; 0841 continua bloqueando encerramento.
