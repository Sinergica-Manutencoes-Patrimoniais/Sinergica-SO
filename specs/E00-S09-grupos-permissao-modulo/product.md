---
name: product
description: PRD-lite de Grupos e permissões por módulo — fundação (schema, resolver, hook, gestão de usuário).
alwaysApply: false
---

# Product — Grupos e Permissões por Módulo: Fundação

> **Tier:** arquitetural · **Status:** aprovado · **Dono:** Lucas / Claude (sessão)
> Responde: **por quê** e **para quem**. Mantém em 1 página.

## Problema
O RBAC atual (`superadmin/supervisor/colaborador/cliente-sindico`, `E00-S05`/`E00-S08`) é fixo:
um papel dá acesso a um conjunto hardcoded de tabelas, igual para todo mundo com aquele papel.
O Sinérgica SO é um sistema operacional de empresa inteira — conforme a Sinérgica cresce em
número de colaboradores e times, vão existir combinações de acesso por módulo (PCM, Comercial,
Financeiro etc.) que não cabem em 2 papéis fixos. Hoje, cada combinação nova exigiria código e
migration novos — não escala.

## Para quem
- **Superadmin/supervisor**: precisam poder desenhar o acesso da equipe sem depender de uma
  sessão de desenvolvimento a cada mudança de política de acesso.
- **Colaboradores em geral**: precisam ver só os módulos que fazem sentido pro seu trabalho —
  hoje todo mundo vê os 10 módulos da sidebar, sem distinção nenhuma.

## Resultado esperado / métrica de sucesso
- Métrica: nº de combinações de acesso possíveis sem precisar de deploy novo.
- Baseline: hoje, 2 combinações fixas (supervisor, colaborador). Alvo: qualquer combinação de
  leitura/escrita/nenhum acesso nos 9 módulos, criável pelo superadmin/supervisor via grupo.

## Goals
- Permitir que superadmin/supervisor criem grupos reutilizáveis de permissão por módulo.
- Permitir atribuir um usuário a um grupo OU configurar o acesso dele módulo a módulo,
  individualmente (nunca os dois ao mesmo tempo).
- Substituir o runbook manual de criação de usuário (SQL Editor) por um fluxo real via
  aplicação.

## Non-goals
- UI administrativa (telas) — fica para `E00-S10`, que consome esta fundação.
- Granularidade menor que módulo inteiro (ex.: campo a campo, tela a tela dentro de um módulo).
- Atualização instantânea de permissão — mesmo trade-off do `ADR-0003` (reflete no próximo
  login/refresh de token, até ~1h).
- Mudar o que `cliente-sindico` pode fazer — inalterado, ator externo.
- Combinar grupo + permissão individual para o mesmo usuário (override) — é um ou outro.

## Riscos / premissas
- Premissa: o volume de usuários/grupos é pequeno (dezenas), então `jsonb_object_agg` no claim
  JWT e `union all` no resolver não têm problema de tamanho/performance.
- Risco: reescrever o `custom_access_token_hook` é a peça de maior risco — um bug ali quebra
  autorização pra todo mundo no próximo refresh de token. Mitigado com pgTAP cobrindo os dois
  modos (grupo/individual) e o caso superadmin/inativo antes do merge.
