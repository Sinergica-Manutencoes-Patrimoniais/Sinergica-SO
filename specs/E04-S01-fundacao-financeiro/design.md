---
name: design
description: Technical Design Doc — schema `financeiro` completo (E04), RLS, parser OFX, gráficos, integrações PCM. Aprovado para o épico; S01 implementa a fundação.
alwaysApply: false
---

# Technical Design Doc — Módulo Financeiro (épico E04)

> **Tier:** arquitetural — novo bounded context com dados de produção. Este design cobre o schema
> do **épico inteiro** (evita migration retrabalhada a cada story); cada story cria **apenas** as
> tabelas marcadas como suas. Padrões do repo obrigatórios: RLS FORCE em toda tabela, valores
> monetários em **centavos (`integer`)** (mesmo padrão de `pcm.servicos`/`pcm.despesas`), migration
> `NNNN_E04-S0N_descricao.sql` em `supabase/migrations/` (sequência nunca pula — confira o último
> número na pasta; era `0083` quando este design foi escrito).

## Contexto da funcionalidade
Schema `financeiro` existe vazio desde `0001_E00-S00_schemas_dominio.sql`. Feature folder
`apps/web/src/features/financeiro/` só tem `.gitkeep`. Gating de permissão por módulo já funciona
(claims JWT `user_role` + `user_modulos` — E00-S09/S10; `financeiro` já é um `ModuloId` válido em
`apps/web/src/features/config/domain/modulo.ts`). Dados de custo já entram pelo PCM:
`pcm.despesas`/`pcm.despesa_tipos` (E01-S54) e horas por OS em `pcm.ordens_servico.auvo_detalhes`.

## Goals / Non-goals
**Goals:** fluxo de caixa (previsto + realizado), classificação por plano de contas, conciliação
via OFX, contas a pagar/receber com vencimento, rentabilidade por cliente/contrato.
**Non-goals:** NF-e, Open Finance, portal do síndico (E09 — mas as policies não podem impedir
views futuras), folha de pagamento, espelho do Financeiro Auvo.

## Arquitetura da feature (hexagonal, igual `features/pcm/`)
```
apps/web/src/features/financeiro/
  domain/          # puro, sem I/O: lancamento.ts, categoria.ts, ofx.ts (parser), conciliacao.ts,
                   # rentabilidade.ts, recorrencia.ts — toda regra testável por unit
  application/     # casos de uso + porta financeiro-gateway.ts
  infrastructure/  # supabase-financeiro-adapter.ts (supabase-js sob RLS; nunca service_role)
  components/      # LancamentoFormModal, TabelaLancamentos, ImportOfxWizard, graficos/*
  pages/           # FinanceiroDashboardPage, LancamentosPage, CategoriasPage, ContasPage,
                   # ImportOfxPage, ContasReceberPage, ContasPagarPage, ContratosPage,
                   # RentabilidadePage, CustosPessoalPage
```
Navegação: itens no grupo FINANCEIRO da sidebar em `apps/web/src/app/HomePage.tsx`, mesmo padrão
de wiring por `useState` usado pelo PCM (sem lib de rotas). Gate:
`podeAcessar('financeiro','leitura')` para ver, `'escrita'` para criar/editar.

## Schema `financeiro` — contrato das tabelas

Colunas comuns a toda tabela: `id uuid primary key default gen_random_uuid()`,
`created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`
(+ trigger de `updated_at` se o padrão do repo for aplicado), `created_by uuid references
auth.users (id) default auth.uid()`.

### S01 — fundação
```sql
financeiro.categorias (
  nome text not null,
  tipo text not null check (tipo in ('entrada','saida')),
  parent_id uuid references financeiro.categorias (id),  -- máx. 2 níveis (validar no domínio)
  ativo boolean not null default true,
  seed boolean not null default false                     -- veio do seed inicial (pode editar/desativar)
)
financeiro.contas_bancarias (
  nome text not null,           -- ex.: "Itaú PJ"
  banco text,                   -- nome/número do banco
  saldo_inicial_centavos integer not null default 0,
  saldo_inicial_em date not null,   -- data de corte do saldo inicial
  ativo boolean not null default true
)
financeiro.fornecedores (
  nome text not null,
  documento text,               -- CNPJ/CPF, sem validação forte no V1
  contato text,
  ativo boolean not null default true
)
financeiro.lancamentos (
  tipo text not null check (tipo in ('entrada','saida')),
  status text not null default 'realizado' check (status in ('previsto','realizado')),
  valor_centavos integer not null check (valor_centavos > 0),  -- sinal vem de `tipo`
  data_competencia date not null,       -- mês a que pertence (regime de competência)
  data_vencimento date,                 -- obrigatória quando status='previsto'
  data_pagamento date,                  -- obrigatória quando status='realizado'
  categoria_id uuid not null references financeiro.categorias (id),
  conta_id uuid references financeiro.contas_bancarias (id),   -- null = ainda não sabe a conta
  cliente_id uuid references pcm.clientes (id),                -- receita/custo atribuível a cliente
  fornecedor_id uuid references financeiro.fornecedores (id),
  contrato_id uuid,                     -- FK adicionada na S04 (NOT VALID → VALIDATE)
  os_id uuid references pcm.ordens_servico (id),
  origem text not null default 'manual' check (origem in ('manual','ofx','recorrencia')),
  extrato_transacao_id uuid,            -- FK adicionada na S02; preenchida = conciliado
  descricao text
)
```
Regra de domínio (não constraint): **lançamento conciliado** (`extrato_transacao_id` preenchido)
não pode ser excluído nem ter valor/conta alterados — desfazer a conciliação primeiro.
"Conciliado" é estado derivado, não um terceiro valor de `status`.

Seed de categorias (na migration da S01, `seed=true`): **Entrada:** Receita de contrato, Serviços
avulsos, Laudos e inspeções, Outras receitas. **Saída:** Pessoal (Salários, Encargos, Benefícios,
Pró-labore), Operação (Combustível, Peças e materiais, EPI, Ferramentas, Terceiros), Veículos
(Manutenção, Seguro/IPVA), Administrativo (Aluguel, Contas de consumo, Software e assinaturas,
Contabilidade), Impostos e taxas, Tarifas e juros bancários.

### S02 — import OFX
```sql
financeiro.extrato_transacoes (
  conta_id uuid not null references financeiro.contas_bancarias (id),
  fitid text not null,                  -- unique (conta_id, fitid) → dedupe de reimport
  data date not null,
  valor_centavos integer not null,      -- COM sinal (negativo = débito), como vem no OFX
  memo text,
  tipo_ofx text,                        -- TRNTYPE cru (DEBIT/CREDIT/PIX/...)
  status text not null default 'pendente' check (status in ('pendente','conciliado','ignorado')),
  lancamento_id uuid references financeiro.lancamentos (id),
  importado_em timestamptz not null default now()
)
financeiro.regras_classificacao (
  padrao text not null,                 -- substring case-insensitive sobre memo
  categoria_id uuid references financeiro.categorias (id),
  cliente_id uuid references pcm.clientes (id),
  fornecedor_id uuid references financeiro.fornecedores (id),
  ativo boolean not null default true
)
```
+ na S02: `alter table financeiro.lancamentos add constraint ... foreign key
(extrato_transacao_id) references financeiro.extrato_transacoes (id) not valid;` → `validate`.

### S04 — contratos + receber
```sql
financeiro.contratos (
  cliente_id uuid not null references pcm.clientes (id),
  descricao text,
  valor_mensal_centavos integer not null check (valor_mensal_centavos > 0),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 28),
  inicio date not null,
  fim date,                             -- null = vigente sem prazo
  status text not null default 'ativo' check (status in ('ativo','suspenso','encerrado')),
  bloqueia_os_em_atraso boolean not null default false  -- flag preparada; enforcement fora do V1
)
-- recebível = lancamento (tipo='entrada', status='previsto', origem='recorrencia',
-- contrato_id preenchido). Idempotência da geração: unique parcial
create unique index ... on financeiro.lancamentos (contrato_id, data_competencia)
  where origem = 'recorrencia';
```

### S05 — pagar + projeção
```sql
financeiro.recorrencias (        -- despesa fixa (aluguel, salários, software...)
  descricao text not null,
  tipo text not null default 'saida' check (tipo in ('saida')),  -- receita recorrente = contratos
  valor_centavos integer not null check (valor_centavos > 0),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 28),
  categoria_id uuid not null references financeiro.categorias (id),
  fornecedor_id uuid references financeiro.fornecedores (id),
  conta_id uuid references financeiro.contas_bancarias (id),
  ativo boolean not null default true
)
-- idempotência: coluna financeiro.lancamentos.recorrencia_id uuid (FK) + unique parcial
-- (recorrencia_id, data_competencia) where origem='recorrencia'
```

### S06 — rentabilidade
```sql
financeiro.custos_funcionario (
  funcionario_id uuid not null references pcm.funcionarios (id),
  custo_mensal_centavos integer not null check (custo_mensal_centavos > 0), -- salário+encargos+benefícios
  horas_mes_base numeric(5,1) not null default 220.0,
  vigente_desde date not null,
  unique (funcionario_id, vigente_desde)   -- histórico versionado; vigente = maior vigente_desde <= data
)
-- + views: financeiro.rentabilidade_cliente_mes, financeiro.posicao_caixa, financeiro.aging_recebiveis
--   (security_invoker = on, para respeitarem a RLS de quem consulta)
```

## RLS (obrigatório em TODA tabela — padrão do repo, ver `0079_E01-S54`)
```sql
alter table financeiro.<t> enable row level security;
alter table financeiro.<t> force row level security;
grant usage on schema financeiro to authenticated, service_role;  -- uma vez, na migration da S01
grant select on financeiro.<t> to authenticated;
grant select, insert, update, delete on financeiro.<t> to service_role;
grant insert, update, delete on financeiro.<t> to authenticated;  -- a RLS restringe

create policy "<t>_select_financeiro" on financeiro.<t> for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura','escrita'));
create policy "<t>_write_financeiro" on financeiro.<t> for insert to authenticated
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
-- update/delete análogos (using + with check com a condição de escrita)
```
`cliente-sindico` não tem policy nenhuma → deny by default (visão do síndico é E09, com views
dedicadas). O schema precisa ser exposto no PostgREST: adicionar `financeiro` a `db.schemas` em
`supabase/config.toml` (mesmo passo feito para `relacionamento` na E02-S08) e conferir a exposição
em produção (E00-S05 fez isso via Management API para os schemas iniciais).

## Decisões técnicas (fechadas neste design)

**D-1 · Parser OFX: implementação própria, client-side, no domínio.**
OFX 1.x é SGML (tags sem fechamento) e 2.x é XML; bancos BR usam ambos, com encoding
`windows-1252` frequente. Arquivo de extrato é pequeno (KBs) — parse no browser, zero
infraestrutura nova. `domain/ofx.ts` expõe `parseOfx(texto: string): TransacaoOfx[]` — função
pura, testada com fixtures reais anonimizadas (Lucas fornece OFX do banco da Sinérgica). Sem lib
nova (padrão do repo: evitar dependências). Campos mínimos: `FITID`, `DTPOSTED`, `TRNAMT`,
`MEMO`/`NAME`, `TRNTYPE`; `BANKID`/`ACCTID` exibidos na prévia para o usuário confirmar a conta.
Valor: `TRNAMT` decimal com ponto → centavos por parse de string (nunca float × 100).

**D-2 · Gráficos: SVG próprio, sem lib.**
O repo não tem nenhuma lib de chart e o padrão até aqui é evitar dependências novas (E01-S61 fez
drag-and-drop nativo pelo mesmo motivo). Os gráficos do V1 são simples (barras mensais, donut de
categorias, linha de saldo) — componentes SVG em `components/graficos/`, tema claro/escuro via
tokens CSS existentes. Quem implementar a S03 deve consultar a skill `dataviz` antes de codar. Se
a complexidade explodir, a troca por lib é decisão nova (ADR), não silenciosa.

**D-3 · Agregações server-side via RPC `security invoker`.**
Mesmo padrão de `fn_kpis_ordens_servico` (migration `0076`): KPIs/séries do dashboard vêm de RPCs
SQL (`financeiro.fn_resumo_caixa`, `fn_fluxo_mensal`, `fn_projecao_caixa`) — nunca baixar a tabela
inteira pro browser (anti-padrão eliminado na E01-S44). `security invoker` para respeitar RLS.

**D-4 · Recorrência: RPC idempotente + pg_cron mensal + botão na UI.**
`financeiro.fn_gerar_recorrencias(competencia date)` gera os lançamentos previstos do mês
(contratos ativos na S04, recorrências de saída na S05), protegida pelos unique parciais.
pg_cron dia 1 (mesmo padrão de `0011`/`0013` — reusa secrets do Vault) + botão "Gerar previstos do
mês" na UI (mesma RPC; rodar duas vezes não duplica).

**D-5 · Contratos nascem no Financeiro (não esperar E03).**
O módulo Comercial não existe; a receita recorrente precisa de cadastro agora. Quando E03 nascer,
`financeiro.contratos` é promovida/referenciada (o Comercial passa a ser dono do ciclo proposta →
contrato; o Financeiro consome). Registrar ADR na S04 se o formato divergir deste design.

**D-6 · Sem Edge Function nova no épico.**
Todo o fluxo é UI → supabase-js sob RLS + RPCs SQL. Não há segredo externo nem integração nova —
o Auvo já entra pelo motor de sync existente do PCM.

## Integrações (fontes de dado existentes)
| Fonte | O que fornece | Como consumir |
|-------|---------------|---------------|
| `pcm.ordens_servico.auvo_detalhes` (jsonb) | horas reais por OS (check-in/out, duração — populado desde E01-S38) | S06: extrair duração; **confirmar chaves reais do jsonb em produção antes da view** |
| `pcm.despesas` / `pcm.despesa_tipos` | despesas de campo por task/funcionário (`valor_centavos`, `auvo_task_id`) | S06: juntar à OS via `auvo_task_id`; endpoint Auvo com bug 500 (chamado aberto) — tratar tabela vazia como 0, não como erro |
| `pcm.funcionarios` | funcionários reais (sync Auvo) | S06: FK de `custos_funcionario` |
| `pcm.clientes` | condomínios | S01/S04/S06: FK de lançamentos/contratos |

## Alternativas consideradas
- **Lib OFX pronta (ofx-js etc.):** descartada — parsers JS de OFX 1.x SGML são mal mantidos e o
  formato mínimo necessário é pequeno; fixture real vale mais que lib.
- **Recharts para gráficos:** adiada — bundle e dependência nova para 3 gráficos simples; ver D-2.
- **Open Finance / API bancária:** descartada no V1 por decisão de escopo (D3, ESCOPO-MESTRE §11).
- **`numeric` para dinheiro:** descartado — repo padroniza centavos `integer`; teto de
  ±R$ 21,4 mi por lançamento é confortável para o porte (somas agregadas em SQL viram `bigint`).

## Riscos
- **Divergência com E03 Comercial** (contratos) — mitigado em D-5.
- **OFX de banco não testado** (layout fora do fixture) — parser tolerante + tela de prévia mostra
  o que foi lido antes de gravar; transação ilegível entra como pendente com memo cru.
- **`user_modulos` sem `financeiro`** para usuários existentes — o superadmin atribui pelo
  gerenciador de grupos (E00-S10); nenhuma migration de permissão necessária.
- **Volume**: baixo (dezenas de lançamentos/mês) — sem particionamento/materialized view no V1.

## Questões em aberto (não bloqueiam S01)
1. Arquivo OFX real do banco da Sinérgica (anonimizado) para fixture — **Lucas fornece** antes da S02.
2. Validar o seed de categorias com o time financeiro (editável em tela; seed é só ponto de partida).
