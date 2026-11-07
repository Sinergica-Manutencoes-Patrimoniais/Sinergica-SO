---
name: "docs-adr-0228-horizonte-capacidade-incompleto-md"
description: "Documento Sinérgica SO: ADR-0228 — Horizonte de capacidade com completude explícita"
alwaysApply: false
---

# ADR-0228 — Horizonte de capacidade com completude explícita

Status: proposta, não homologada.

Horizonte limitado a até 12 semanas mostra contagens de declarações e Visitas locais, sem somar horas ou gerar saldo. As duas fontes ainda não provam disponibilidade real nem demanda restante deduplicada, logo resultado sempre marca capacidade e demanda incompletas; campos calculados permanecem nulos. Não bloqueia planejamento e não infere jornada. Gate e RPC fechados.

Não apresentar saldo numérico antes de demonstrar jornadas, conflitos, reservas/ausências, esforço restante, equipe simultânea, especialidade e deduplicação de ocorrência/OS. Testes, revisão adversarial e reconciliação das fontes são obrigatórios.
