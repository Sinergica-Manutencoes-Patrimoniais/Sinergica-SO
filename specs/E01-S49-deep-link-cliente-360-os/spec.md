---
name: spec
description: Contrato — itens de OS na Visão 360 do cliente navegam até a OS em Ordens de Serviço.
alwaysApply: true
---

# Spec — Deep-link: itens do cliente-360 abrem a OS específica

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Feedback de teste manual do Lucas (2026-07-09, ponto 6): "No 360 as OS devem ser clicáveis e navegar
> até a OS, mas isso vale para todos os itens." Escopo desta story: itens de OS (Backlog, Histórico,
> eventos de timeline do tipo OS) — os únicos com destino navegável hoje (Inspeções/Laudos/Ativos não têm
> uma tela própria por id ainda).

## Resumo
`PainelBacklog`/`PainelHistorico` e eventos de timeline do tipo `"os"` na Visão 360 passam a ser
clicáveis, navegando pra Ordens de Serviço com o painel de detalhe da OS já aberto. O app não usa router
(nav SPA manual em `HomePage.tsx`) — o mecanismo é um estado de deep-link explícito.

## Critérios de aceite

### AC-1: Clicar numa OS do Backlog/Histórico navega
- **Dado** a aba "OS" da Visão 360
- **Quando** o usuário clica numa linha de `PainelBacklog` ou `PainelHistorico`
- **Então** a tela troca pra Ordens de Serviço com o painel de detalhe dessa OS já aberto

### AC-2: Clicar num evento de timeline do tipo OS navega
- **Dado** a aba Timeline (ou o resumo compacto na aba Resumo)
- **Quando** o usuário clica num evento com `tipo === "os"`
- **Então** mesmo comportamento do AC-1

### AC-3: Deep-link ignora filtro ativo
- **Dado** a tela de Ordens de Serviço com um filtro de status ativo que excluiria a OS de destino
- **Quando** o deep-link abre
- **Então** o painel de detalhe abre mesmo assim (a seleção não depende do filtro)

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Clicabilidade de Inspeções/Laudos/Ativos — não têm tela própria navegável por id ainda.
- Botão "voltar ao cliente" — nice-to-have, incluído se coube no tempo, não é AC obrigatório.

## Rastreabilidade
- Plano: `~/.claude/plans/foi-entregue-uma-serie-generic-owl.md`
- Arquivos-âncora: `apps/web/src/app/HomePage.tsx`,
  `apps/web/src/features/pcm/pages/VisaoClientePage.tsx`,
  `apps/web/src/features/pcm/components/PainelBacklog.tsx`,
  `apps/web/src/features/pcm/components/PainelHistorico.tsx`,
  `apps/web/src/features/pcm/pages/OrdensServicoPage.tsx`.
