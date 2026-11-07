---
name: "docs-adr-1010-integridade-assessment-proposta-md"
description: "Documento Sinérgica SO: ADR-1010 — Integridade de Cliente do assessment na proposta"
alwaysApply: false
---

# ADR-1010 — Integridade de Cliente do assessment na proposta

Status: preparação fechada, não homologada.

Preparar guarda comum para alterações que possam criar divergência entre Cliente da oportunidade e Cliente da inspeção vinculada: inserção ou troca de assessment/oportunidade da proposta, troca de Cliente da oportunidade e troca de Cliente da inspeção. As três entradas usam a mesma trava transacional não bloqueante e o mesmo gate, inicialmente fechado. A guarda verifica identidade e vínculo, não altera dados nem corrige divergências históricas.

O cliente legado continuará operando até rollout coordenado; antes de ativar, inventariar dados divergentes e analisar fluxos existentes, status de propostas, índices, locks, RLS/FORCE, privilégios e concorrência nas duas ordens. A guarda de integridade não substitui autorização de escrita ou snapshot de proposta enviada. Revisão adversarial e testes integrados são obrigatórios antes de produção.
