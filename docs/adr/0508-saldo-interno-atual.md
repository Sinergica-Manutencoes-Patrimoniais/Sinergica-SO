---
name: "docs-adr-0508-saldo-interno-atual-md"
description: "Documento Sinérgica SO: ADR-0508 — consulta do saldo interno atual"
alwaysApply: false
---

# ADR-0508 — consulta do saldo interno atual

Status: proposto; não aplicado nem homologado. A projeção autorizada calcula valor conferido, alocações não estornadas, reserva interna ativa e saldo disponível no mesmo snapshot da consulta. Saldo negativo é apresentado como divergência, nunca corrigido silenciosamente. A consulta não garante saldo futuro; comandos revalidam sob locks. Gates e grants fechados; concorrência, permissões e todas as origens de saldo exigem revisão e testes.
