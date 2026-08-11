---
name: product
description: PRD-lite — fluidez e performance do board de Chamados/OS.
alwaysApply: false
---

# Product — Fluidez e performance de Chamados

> **Tier:** arquitetural · **Status:** aprovado · **Dono:** @pm

## Problema
O board de Chamados/OS baixa todas as OS filtradas, catálogos repetidos e dados pesados antes de
ficar utilizável. Com cerca de 2,6 mil OS, a entrada pode envolver até 13 consultas e milhares de
linhas React. Filtros sucessivos não cancelam requests antigos; Lista, Kanban e Backlog não têm
paginação real. Resultado: navegação lenta e resposta inconsistente conforme a base cresce.

## Para quem
Operadores, supervisores e gestores do PCM que acessam Chamados durante toda a jornada de trabalho,
principalmente para triagem, planejamento, alteração de status e consulta de histórico.

## Resultado esperado / métrica de sucesso
- Consultas críticas do banco: `< 100 ms` em `EXPLAIN ANALYZE`.
- API do fluxo: p95 `< 500 ms`.
- Clique até feedback visual: `< 100 ms`; clique até conteúdo útil: p95 `< 1,5 s`.
- INP `< 200 ms`; payload inicial do board `< 150 KB`.
- Carga crítica inicial: no máximo 2 consultas de negócio (feed + KPIs).
- Bundle gzip: crescimento máximo de 20 KB nesta story.

## Goals
- Abrir Chamados mostrando itens ativos e uma primeira página limitada.
- Paginar todas as visões com cursor estável e botão “Carregar mais”.
- Evitar overfetch, requests duplicados e respostas antigas sobrescrevendo filtros novos.
- Manter dados anteriores durante atualização e carregar detalhes/catálogos sob demanda.
- Tornar alterações de status rápidas, otimistas e reversíveis em caso de erro.

## Non-goals
- Code splitting, rotas reais ou redução global do bundle — responsabilidade da E00-S21.
- Biblioteca de virtualização.
- Mudança do modelo de domínio Chamado/OS ou fusão física das tabelas.
- Telemetria externa/RUM ou feature flag.

## Riscos / premissas
- A migration é aditiva e deve entrar antes do frontend; rollback do frontend continua compatível.
- O read model respeita RLS das tabelas-base via `security_invoker`.
- KPIs ignoram apenas filtro de status, preservando contexto global; contador da lista reflete o
  filtro efetivo.
