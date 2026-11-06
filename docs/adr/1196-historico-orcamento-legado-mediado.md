# ADR-1196 — Histórico legado mediado por Cliente

## Contexto

As interfaces de orçamento legado por OS e pré-OS chamam funções privadas que não possuem concessão ao usuário autenticado. As consultas são parciais, sem valores ou reemissão; uma eventual multiplicidade de decisões pode repetir o orçamento e comprometer o cursor.

## Decisão

Preparar duas entradas autenticadas, com ator, Cliente, autorização atual, gates existentes e paginação por UUID. Antes de devolver uma página, examinar uma linha adicional e rejeitar resposta com IDs repetidos ou fora da ordem/cursor, inclusive repetição na borda. Limite público 99 para respeitar teto 100 da consulta interna. A tela deve conferir sessão e contrato e apresentar erro, não omitir silenciosamente registros inconsistentes.

## Limitações

A rejeição não reconcilia múltiplas decisões antigas e não prova integridade histórica ou fotografia entre páginas. Validar multiplicidade real, vínculos, paginação, permissões, RLS/FORCE, concorrência, propriedade das funções e revisão adversarial antes de aplicar ou habilitar. Não altera registros legados, cria OS ou reemite orçamento.
