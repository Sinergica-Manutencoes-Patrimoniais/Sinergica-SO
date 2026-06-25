---
name: spec-E00-S02-home-dashboard
description: Contrato do redesign da home — sidebar + abas superiores por módulo + dashboard operacional do PCM.
alwaysApply: false
---

# Spec — E00-S02: Home Dashboard (Sidebar + Abas + PCM)

> Épico: E00 — Shell & Infra · Tier: pequeno · Status: **implementado (SPEC_DEVIATION)**
> SPEC_DEVIATION: implementado sem abertura formal de story. Registrado retroativamente.
> Agentes que DEVERIAM ter atuado: @pm (escopo), @sm (tasks), @dev (implementação), @qa (validação).

## Resumo
Redesign da home do OS para layout profissional com sidebar de navegação contextual,
abas superiores para troca de módulo e conteúdo focado em dados operacionais.
O módulo PCM exibe dashboard com KPIs reais da operação; demais módulos exibem placeholder
"Em construção" enquanto não são desenvolvidos.

## Critérios de aceite (AC)

### AC-1: Sidebar contextual por módulo ativo
- Dado um usuário autenticado com o módulo PCM ativo
- Quando a home renderizar
- Então a sidebar exibe grupos de navegação (OPERAÇÃO, PREVENTIVO, RELATÓRIOS) com itens do PCM

### AC-2: Sidebar minimal para módulos não construídos
- Dado um usuário que clicou em qualquer aba que não seja PCM
- Quando o módulo não-PCM renderizar
- Então a sidebar exibe mensagem de navegação indisponível (sem itens quebrados)

### AC-3: Abas superiores trocam o módulo ativo
- Dado um usuário autenticado na home
- Quando clicar em qualquer aba de módulo no topo
- Então o conteúdo principal e a sidebar mudam para o módulo selecionado sem recarregar a página

### AC-4: Dashboard PCM com KPIs operacionais
- Dado o módulo PCM ativo
- Quando o dashboard renderizar
- Então exibe grid de KPIs (OS Abertas, Em Andamento, Backlog, SLA), tabela de OS recentes com status/prioridade e top backlog GUT por score

### AC-5: Placeholder "Em construção" para módulos não implementados
- Dado qualquer módulo além do PCM ativo
- Quando o conteúdo renderizar
- Então exibe ícone do módulo, nome, descrição e badge "Em construção" centralizado

### AC-6: Layout responsivo — não quebra em telas menores
- Dado um usuário em tela < 1024px
- Quando a home renderizar
- Então o grid de KPIs reduz para 2 colunas e a tabela de OS mantém leitura (truncate nos textos longos)

## Fora de escopo (VINCULANTE)
- Links de navegação da sidebar funcionais (todos são visuais por enquanto).
- Dados reais do banco (todos os KPIs e OS são mock estático).
- Filtro de período (ex.: "30 dias") — feature futura do Cockpit (E08).
- Módulos além do PCM com dashboard real — cada um tem sua própria story.

## Rastreabilidade
- Tasks: [tasks.md](tasks.md)
- Implementação: `apps/web/src/app/HomePage.tsx`
- Épico: [ROADMAP.md](../../docs/epics/ROADMAP.md)

## SPEC_DEVIATION
- `SPEC_DEVIATION: story implementada sem processo formal de agentes Triviaiox.`
  Corrigir nas próximas stories: @pm define escopo → @sm cria tasks → @dev implementa.
