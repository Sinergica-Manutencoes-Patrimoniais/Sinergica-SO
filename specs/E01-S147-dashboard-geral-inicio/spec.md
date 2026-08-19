---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Dashboard geral real na tela Início

> **Fonte da verdade.** Status: rascunho
> Os AC são (a) o contrato com o negócio, (b) o oráculo de teste, (c) o prompt para o agente
> implementar. Escreva-os para serem executáveis.

## Resumo
A tela Início (`DashboardGeral` em `apps/web/src/app/HomePage.tsx`) troca o array
`DASHBOARD_GERAL` 100% mockado por KPIs reais de PCM, Atendimento e Financeiro — cada card busca
via TanStack Query os dados que a página de dashboard do próprio módulo já expõe, carrega e falha
de forma independente, e nunca inventa número pra módulo sem integração pronta.

## Contexto (não normativo)
`DASHBOARD_GERAL` foi escrito quando o projeto ainda não tinha dado real (comentário `mock data`
no próprio código-fonte, desde a fundação do épico). Hoje três módulos já têm dashboard funcional
com dado real:
- **PCM**: `montarDashboardPcm`/`montarCockpitBomDia` em
  `features/pcm/domain/dashboard-pcm.ts` (consumido por `PcmDashboardPage.tsx`).
- **Atendimento**: `montarPainelAtendimento` em `features/atendimento/domain/dashboard-atendimento.ts`
  (consumido por `AtendimentoDashboardPage.tsx`), fonte é a RPC `atendimento.fn_metrics_snapshot`.
- **Financeiro**: `ResumoCaixa` (`obterResumoCaixa`) em `features/financeiro/application/dashboard.ts`
  (consumido por `FinanceiroDashboardPage.tsx`).

Nenhum dos três hoje expõe hook TanStack Query (`application/<dominio>-queries.ts`) — a própria
página do módulo ainda busca via `useState`/`useEffect`. Esta story **não migra as páginas
existentes**; cria hooks novos, específicos do card do Início, que chamam as mesmas funções de
domínio/aplicação já existentes (reuso, não duplicação de regra).

`DASHBOARD_GERAL` mockado tem 7 módulos, não só os 3 confirmados: **Comercial**, **Marketing**,
**Gestão** (Cockpit) e **Área do Cliente** também aparecem hoje com número inventado.
- **Comercial** já tem dado real E já segue o padrão `-queries.ts`
  (`features/comercial/application/dashboard-queries.ts`) — fora de escopo aqui só porque não foi
  confirmado pelo Lucas como parte desta leva; candidato natural de próxima story.
- **Marketing** e **Gestão** não têm nenhuma implementação (`features/marketing/` e
  `features/gestao/` só têm `.gitkeep`) — sem dado real possível, ver AC-6.
- **Área do Cliente** tem stories reais no épico E09 (portal do síndico), mas não foi auditado
  nesta investigação nem confirmado pelo Lucas — trata como os demais não confirmados: AC-6 por
  ora, revisitar em story própria.

## Critérios de aceite

### AC-1: Card de PCM mostra KPI real
- **Dado** um usuário com permissão de leitura no módulo PCM logado na tela Início
- **Quando** a tela carrega
- **Então** o card de PCM mostra KPIs vindos de `montarDashboardPcm` (mínimo: `OS Abertas`, `Em
  Execução`, `Backlog GUT`) — nunca os valores fixos do array `DASHBOARD_GERAL` removido

### AC-2: Card de Atendimento mostra KPI real
- **Dado** um usuário com permissão de leitura no módulo Atendimento
- **Quando** a tela Início carrega
- **Então** o card mostra KPIs vindos de `montarPainelAtendimento` (mínimo: `Fila sem atendente`,
  `Conversas abertas`, `Não lidas`)

### AC-3: Card de Financeiro mostra KPI real
- **Dado** um usuário com permissão de leitura no módulo Financeiro
- **Quando** a tela Início carrega
- **Então** o card mostra KPIs vindos de `ResumoCaixa` (mínimo: `Posição de caixa`, `Resultado do
  mês`, `A receber (30d)`), formatados em R$ via `centavosParaReais` (não centavos crus)

### AC-4: Cada card carrega e falha independente
- **Dado** a tela Início com os três cards reais
- **Quando** a query de um módulo (ex.: Financeiro) está pendente ou falha
- **Então** os outros dois cards continuam mostrando seu próprio estado (pronto/carregando) sem
  travar nem re-renderizar por causa do módulo lento/quebrado — cada card é uma `useQuery`
  independente, nunca um `Promise.all` que aguarda todos pra mostrar qualquer um

### AC-5: Card em erro mostra estado de erro, não quebra a tela
- **Dado** a query de um módulo falhou (rede, RPC, permissão)
- **Quando** a tela Início está visível
- **Então** aquele card mostra um estado de erro compacto dentro do próprio card (texto curto +
  ação de tentar de novo), sem lançar exceção não capturada nem remover os outros cards da grade

### AC-6: Módulo sem dado real não inventa número
- **Dado** o card de Comercial, Marketing, Gestão ou Área do Cliente (não confirmados nesta leva
  — ver Contexto) ou qualquer módulo futuro sem dado real
- **Quando** a tela Início carrega
- **Então** o card mostra um estado vazio explícito (`EmptyState` do design system, variante
  `vazio`, texto tipo "Sem dados disponíveis ainda") — nunca um KPI fixo/inventado

### AC-7: Gating de permissão evita fetch desnecessário
- **Dado** um usuário sem permissão de leitura em um dos três módulos (PCM/Atendimento/Financeiro)
- **Quando** a tela Início carrega
- **Então** o hook daquele módulo nem dispara a query (`enabled: false` na `useQuery`, mesmo
  `podeVerModulo` já usado pro filtro visual) — nunca tenta buscar dado que o usuário não pode ver
  e depois esconde na UI

### AC-8: Botão "Ver módulo" continua navegando
- **Dado** qualquer card real ou vazio
- **Quando** o usuário clica em "Ver módulo →"
- **Então** navega pro módulo correspondente exatamente como o comportamento atual (`onSelect`/
  `navegarModulo`) — este AC é regressão, não feature nova

## Casos de borda e erros
- RPC/adapter do módulo devolve lista vazia genuína (ex.: zero OS abertas) → mostra `0`, não
  confundir com estado de erro nem com "sem dados disponíveis" do AC-6.
- Usuário sem nenhum dos três módulos habilitado → tela Início mostra só os cards que restarem
  (Comercial/Marketing, se decidido manter como estão) — comportamento de filtro já existe
  (`dashboardVisivel`/`podeVerModulo`), não muda.
- `staleTime` dos hooks novos segue o padrão do projeto (30s, `app/query-client.ts`) — não inventa
  configuração de cache por card.

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Card de Comercial com dado real (já existe pronto, mas não confirmado pro escopo desta leva).
- Card de Marketing, Gestão ou Área do Cliente com dado real (sem implementação pronta pra
  Marketing/Gestão; Área do Cliente tem stories no E09 mas não foi auditado nesta story).
- Migrar `PcmDashboardPage`/`AtendimentoDashboardPage`/`FinanceiroDashboardPage` pra TanStack
  Query — só os hooks novos do card do Início usam o padrão; as páginas do módulo continuam como
  estão até serem tocadas por outra story (convenção já registrada no `CLAUDE.md`: migração
  acontece quando a tela é tocada, não em campanha).
- Badge de "alerta" no card (hoje ad-hoc por item mockado) — cada card mostra só os KPIs dos AC-1/
  2/3; sinalização de atenção por módulo fica pra story futura, evita inventar limiar sem o Lucas
  confirmar o que conta como alerta em cada módulo.
- Reestruturar `HomePage.tsx` (rotas reais, code splitting) — fora do escopo, ver E00-S21 no
  ROADMAP (já registrado como pendente, mesmo arquivo de alto risco).

## Rastreabilidade
- Product: `../../apps/web/PRODUCT.md` · Design: `../../apps/web/DESIGN.md`
- Módulos de origem do dado: `features/pcm/domain/dashboard-pcm.ts`,
  `features/atendimento/domain/dashboard-atendimento.ts`, `features/financeiro/application/dashboard.ts`
- ADRs relacionados: nenhum (reuso de função de domínio existente, sem decisão nova de
  arquitetura)
