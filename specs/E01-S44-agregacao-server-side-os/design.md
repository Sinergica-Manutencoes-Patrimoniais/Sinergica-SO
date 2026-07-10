---
name: design
description: Design — KPIs de Ordens de Serviço via RPC server-side + filtros empurrados pro WHERE.
alwaysApply: true
---

# Design — Agregação 100% server-side de Ordens de Serviço

> Tier: arquitetural (nova RPC, muda o padrão de fetch de uma tela núcleo do PCM). Pedido explícito
> do Lucas (2026-07-09) depois do lote E01-S39→S51 — reativa o item que tinha ficado só documentado.

## Problema
`supabase-hub-os-adapter.ts:buscarTodasOrdens` sempre baixa **todas** as OS (paginação interna até
10 mil linhas), sem nenhum filtro no `WHERE` — os filtros de status/técnico/categoria/data (E01-S42)
e os KPIs do topo são computados **depois**, em JavaScript, sobre o array inteiro. Já causou um bug
real em produção (`limit(200)` truncando KPIs, corrigido no PR #41) e o próprio código já sinalizava
isso como gambiarra temporária.

## Decisão

1. **RPC `pcm.fn_kpis_ordens_servico`** — agregação SQL (`count(*) filter (where ...)`) que devolve
   os 6 números do topo (total/abertas/planejamento/execução/finalizadas/críticas) sem baixar
   nenhuma linha de OS pro navegador. `security invoker` (padrão, sem `security definer`) — mesmo
   raciocínio documentado em `atendimento.fn_metrics_snapshot` (migration `0052`): rodando com o
   privilégio de quem chama, a RLS FORCE já existente em `pcm.ordens_servico` filtra sozinha por
   `pcm:leitura`, sem duplicar a checagem de permissão dentro da função.
2. **Filtros empurrados pro `WHERE`** — `buscarTodasOrdens` ganha parâmetros opcionais
   (status/técnico/categoria/data) aplicados via `.eq()`/`.gte()`/`.lte()` no Supabase client, em
   vez de buscar tudo e filtrar depois. A paginação interna de 1000-em-1000 (`.range()`) continua
   existindo como rede de segurança pra quando o resultado filtrado ainda for grande — só que agora
   quase nunca precisa passar da primeira página.
3. **Busca livre (texto) continua client-side** — `numero`/`titulo`/`clienteNome` incluem um campo
   (`clienteNome`) que só existe depois do JOIN com `clientes` em memória; empurrar isso pro SQL
   exigiria uma subquery/JOIN a mais só pra esse caso. Mantém `filtrarOrdens` (E01-S42) fazendo esse
   último refinamento sobre o conjunto já filtrado pelo servidor — o ganho real (não baixar as OS que
   não batem status/técnico/categoria/data) já está garantido antes desse passo.
4. **KPIs exibidos**: quando não há busca livre ativa, usam a RPC (não depende do array de OS estar
   carregado). Quando há busca livre, usam `calcularKpisOrdens` sobre o array já filtrado em memória
   (E01-S42 already fez isso — mantém KPIs sempre iguais ao que a lista mostra, sem round-trip
   extra, já que o array já está em mãos).

## Fora de escopo desta entrega
- Paginação de UI de verdade (página 2, "carregar mais") pra Lista — Kanban/Timeline/Calendário
  continuam consumindo o conjunto completo filtrado (precisam do todo pra desenhar colunas/dias). Só
  vira necessário se o volume filtrado sozinho passar de milhares de linhas — não é o caso hoje.
- Empurrar a busca por nome de cliente pro SQL.

## Migration
`0076_E01-S44_rpc_kpis_ordens_servico.sql` — só cria a função (sem mudança de schema/coluna).

## Rastreabilidade
- Precedente de RPC `security invoker` chamada direto do client: `atendimento.fn_metrics_snapshot`
  (migration `0052`, E02-S10).
- Depende de: E01-S42 (`FiltrosOrdens`, já existe).
- Arquivos-âncora: `supabase/migrations/0076_*.sql`,
  `apps/web/src/features/pcm/infrastructure/supabase-hub-os-adapter.ts`,
  `apps/web/src/features/pcm/application/hub-os-gateway.ts`,
  `apps/web/src/features/pcm/application/hub-os.ts`,
  `apps/web/src/features/pcm/pages/OrdensServicoPage.tsx`.
