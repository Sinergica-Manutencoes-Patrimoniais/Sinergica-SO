---
name: design
description: Design — cliente-360 mais rico (contatos, grupos, financeiro honesto), escopo ajustado por falta de acesso à API Auvo real nesta sessão.
alwaysApply: true
---

# Design — Cliente-360 mais rico

> Tier: arquitetural (novo `jsonb` em `pcm.clientes`, tabela de produção). Aprovado por Lucas via
> ExitPlanMode em `~/.claude/plans/foi-entregue-uma-serie-generic-owl.md` (2026-07-09).

## Escopo ajustado (achado durante a E01-S47, vale aqui também)

O plano original previa capturar em `detalhes` campos do Auvo ainda não confirmados (cidade/estado/cep
em nomes reais, coordenadas, `customFields`, grupos/tags brutos) "confirmando contra a API real antes de
implementar". **Esta sessão não tem acesso à API Auvo real** (mesmo achado da E01-S47 — sem
`AUVO_API_KEY`/`AUVO_USER_TOKEN` no ambiente, sem forma seguro de testar contra produção sem um payload
real). Implementar esses campos agora seria adivinhar nome de campo, o que o próprio `client.ts` do
projeto já avisa pra nunca fazer.

**Escopo cortado pro que é seguro sem acesso à API** (nenhum campo novo especulativo):
- `pcm.clientes.detalhes jsonb` — só popula `contacts` (array completo), campo **já confirmado e usado**
  hoje (`fromAuvo` já lê `auvo.contacts?.[0]`, aqui só passamos a guardar o array inteiro, não só o
  primeiro).
- Card **Contatos** na aba Resumo — múltiplos contatos (síndico, zelador, administradora), o caso de uso
  mais direto do "liga alguém, quem é essa pessoa" — usa dado já confirmado.
- Card **Grupos** — `pcm.cliente_grupos` já existe (E01-S27), relacional, sem nada especulativo; hoje não
  aparece em lugar nenhum da 360.
- Aba **Financeiro** — troca o placeholder por `status_comercial` (coluna local já existe) + "OS por
  categoria nos últimos 12 meses" (dado 100% local, de `backlog`+`historico` já carregados pela 360;
  `historico` é limitado a 50 registros mais recentes pelo adapter — a métrica é um proxy aproximado, não
  um relatório fechado, e isso fica dito na tela).

**Fora do escopo desta entrega** (documentado, não implementado):
- Popular `cidade`/`estado`/`cep` (colunas já existem desde a `0022`, nunca escritas) — precisa confirmar
  o nome real do campo Auvo antes (city/cityName/etc.), não dá pra adivinhar.
- Coordenadas, `customFields`, grupos/tags brutos do payload Auvo — mesma razão.
- Dado financeiro real (contrato/faturamento/inadimplência) — sem fonte canônica no OS (já era fora de
  escopo no plano original: é um bounded context próprio, Financeiro).

Quando uma sessão tiver acesso real à API (mesma condição da E01-S47), completar esses campos é aditivo
— a coluna `detalhes` já existe, só falta popular mais chaves no `fromAuvo`.

## Migration
`0075_E01-S51_detalhes_clientes.sql`: `alter table pcm.clientes add column detalhes jsonb` — nullable
puro, sem FK, sem `NOT VALID` necessário (não é constraint).

## Novo dado exposto
- `Cliente360Gateway.listarGruposCliente(clienteId)` — novo método, isolado com try/catch em
  `obterVisaoCliente` (mesmo padrão de `listarEquipamentosCliente`/`listarQualidadeCliente`: falha vira
  `[]`, não derruba a página).
- `ClienteHeader.detalhes` — novo campo opcional, populado só no `buscarCliente` (a Visão 360 de um
  cliente específico; não precisa nos outros selects de cliente — criar/editar/listar não consomem esse
  campo hoje).

## Rastreabilidade
- Plano: `~/.claude/plans/foi-entregue-uma-serie-generic-owl.md`
- Precedente de migration: E01-S38 (`auvo_detalhes` em `pcm.ordens_servico`).
- Relacionado: E01-S47 (mesma limitação de acesso à API real).
- Arquivos-âncora: `supabase/migrations/0075_*.sql`,
  `supabase/functions/_shared/auvo/registry/clientes.ts`,
  `apps/web/src/features/pcm/application/cliente-360-gateway.ts`,
  `apps/web/src/features/pcm/application/obter-visao-cliente.ts`,
  `apps/web/src/features/pcm/infrastructure/supabase-cliente-360-adapter.ts`,
  `apps/web/src/features/pcm/pages/VisaoClientePage.tsx`.
