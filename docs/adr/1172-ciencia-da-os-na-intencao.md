---
name: "docs-adr-1172-ciencia-da-os-na-intencao-md"
description: "Documento Sinérgica SO: ADR-1172 — Ciência da OS na intenção local"
alwaysApply: false
---

# ADR-1172 — Ciência da OS na intenção local

Status: proposta local, não aplicada nem homologada.

Quando o gate de correção estiver ativo e a política de ciência for obrigatória, o comando de intenção local deve verificar confirmação da publicação da própria OS, na revisão atual da Visita. A validação anterior aceitava uma publicação de outra OS da mesma Visita. A correção preserva o comando e seus recibos; ausência de ciência da OS bloqueia nova intenção e recuperação pelo comando mediado, sem apagar histórico.

O gate nasce fechado para rollout coordenado. A decisão aprovada trata a ciência da Visita; comprovar que o modelo de publicações por OS representa corretamente essa decisão, sem impor uma regra operacional nova. Validar clientes antigos, replays, revogação, múltiplas OS, locks, RLS/FORCE e revisão adversarial antes da ativação. O comando continua sem envio externo.
