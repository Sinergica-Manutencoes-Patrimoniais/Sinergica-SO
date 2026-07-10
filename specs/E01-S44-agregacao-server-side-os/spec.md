---
name: spec
description: Contrato — RPC de KPIs server-side + filtros de OS empurrados pro WHERE.
alwaysApply: true
---

# Spec — Agregação 100% server-side de Ordens de Serviço

> **Fonte da verdade.** Status: rascunho · Tier: Arquitetural (ver `design.md`)
> Pedido explícito do Lucas (2026-07-09): implementar o que tinha ficado documentado/adiado na
> E01-S44 original.

## Resumo
KPIs do topo de Ordens de Serviço passam a vir de uma RPC agregada (`pcm.fn_kpis_ordens_servico`)
em vez de `reduce` sobre o array completo carregado no navegador. Filtros de status/técnico/
categoria/data (E01-S42) passam a ser aplicados no `WHERE` da query, não mais em JS depois de baixar
tudo.

## Critérios de aceite

### AC-1: KPIs corretos sem baixar todas as OS
- **Dado** nenhum filtro de busca livre ativo
- **Quando** a tela de Ordens de Serviço carrega
- **Então** os 6 KPIs do topo vêm da RPC `fn_kpis_ordens_servico`, corretos mesmo que o array de OS
  carregado no cliente seja menor (ex.: filtro restringiu a consulta)

### AC-2: Filtros reduzem o que trafega na rede
- **Dado** um filtro de status/técnico/categoria/data aplicado
- **Quando** a lista recarrega
- **Então** a query ao Supabase inclui esse filtro no `WHERE` (`.eq`/`.gte`/`.lte`) — não busca todas
  as OS pra depois filtrar em JS

### AC-3: Busca livre continua funcionando
- **Dado** um termo digitado na busca (número/título/cliente)
- **Quando** aplicado junto com os outros filtros
- **Então** o resultado final é o mesmo de antes (E01-S42) — a busca livre refina o conjunto já
  filtrado pelo servidor

### AC-4: KPIs continuam batendo com a lista quando há busca livre
- **Dado** busca livre ativa
- **Quando** os KPIs são exibidos
- **Então** refletem o conjunto após a busca (não só os filtros server-side) — mesma garantia da
  E01-S42, sem regressão

### AC-5: RLS respeitada
- **Dado** a RPC roda `security invoker`
- **Quando** chamada por um usuário sem `pcm:leitura`
- **Então** a política RLS de `pcm.ordens_servico` já existente bloqueia, sem lógica de permissão
  duplicada dentro da função

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Paginação de UI (página 2/"carregar mais") na Lista.
- Empurrar busca por nome de cliente pro SQL (fica client-side).
- Mudar como Kanban/Timeline/Calendário consomem o conjunto (continuam pegando tudo que passou nos
  filtros de servidor).

## Rastreabilidade
- Design: `./design.md`
- Depende de: E01-S42.
- Arquivos-âncora: ver `design.md`.
