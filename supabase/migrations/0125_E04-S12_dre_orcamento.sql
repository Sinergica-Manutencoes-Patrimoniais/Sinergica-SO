-- 0125_E04-S12_dre_orcamento.sql
-- DRE gerencial por competência (AC-1/AC-4) + orçamento anual por categoria (AC-2/AC-3).
-- `financeiro.orcamentos`: meta por categoria×mês (granularidade mensal cobre "anual/mensal" da
-- spec — a UI pode gravar os 12 meses do ano com o mesmo valor, ou editar mês a mês). DRE e
-- comparativo orçado×realizado são RPCs `security invoker` (mesma fonte que o dashboard de caixa,
-- E04-S03 — AC-4 "diferença só por competência×caixa, nunca por erro de dado").
-- Reverso:
--   drop function if exists financeiro.fn_orcamento_realizado(int);
--   drop function if exists financeiro.fn_dre_mensal(int);
--   drop table if exists financeiro.orcamentos;

create table financeiro.orcamentos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references financeiro.categorias (id),
  competencia date not null,
  valor_centavos bigint not null check (valor_centavos >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  unique (categoria_id, competencia)
);

alter table financeiro.orcamentos enable row level security;
alter table financeiro.orcamentos force row level security;
grant select on financeiro.orcamentos to authenticated;
grant insert, update, delete on financeiro.orcamentos to authenticated;
grant select, insert, update, delete on financeiro.orcamentos to service_role;

create policy "orcamentos_select_financeiro" on financeiro.orcamentos for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
create policy "orcamentos_escrita_financeiro" on financeiro.orcamentos for all to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');

-- AC-1: linhas mês × grupo de categoria (raiz) × tipo — a UI (domain/dre.ts::agregarDre) soma
-- receita/despesas e zera meses sem lançamento. Exclui origem='transferencia' (não é
-- receita/despesa, é movimentação interna — mesmo filtro de fn_resumo_caixa/fn_fluxo_mensal).
create or replace function financeiro.fn_dre_mensal(p_meses int default 12)
returns table (
  mes date,
  tipo text,
  categoria_raiz_nome text,
  valor_centavos bigint
)
language sql
stable
security invoker
set search_path = financeiro, pg_temp
as $$
  select
    date_trunc('month', l.data_competencia)::date as mes,
    l.tipo,
    coalesce(pai.nome, c.nome) as categoria_raiz_nome,
    sum(l.valor_centavos) as valor_centavos
  from financeiro.lancamentos l
  join financeiro.categorias c on c.id = l.categoria_id
  left join financeiro.categorias pai on pai.id = c.parent_id
  where l.origem <> 'transferencia'
    and l.data_competencia >= (date_trunc('month', current_date) - (greatest(p_meses, 1) - 1 || ' month')::interval)::date
  group by 1, 2, 3
  order by 1;
$$;

revoke all on function financeiro.fn_dre_mensal(int) from public;
grant execute on function financeiro.fn_dre_mensal(int) to authenticated;

-- AC-2/AC-3: orçado × realizado por categoria×mês do ano informado. `tem_orcamento=false` cobre o
-- edge case "categoria sem orçamento → só realizado, sem desvio" — a categoria aparece (tem
-- lançamento OU orçamento no ano) mesmo em meses sem orçamento definido pra ela.
create or replace function financeiro.fn_orcamento_realizado(p_ano int)
returns table (
  categoria_id uuid,
  categoria_nome text,
  mes date,
  orcado_centavos bigint,
  realizado_centavos bigint,
  tem_orcamento boolean
)
language sql
stable
security invoker
set search_path = financeiro, pg_temp
as $$
  with meses_ano as (
    select make_date(p_ano, g, 1) as mes from generate_series(1, 12) as g
  ),
  categorias_relevantes as (
    select distinct categoria_id as id from financeiro.orcamentos where extract(year from competencia) = p_ano
    union
    select distinct categoria_id as id from financeiro.lancamentos
    where extract(year from data_competencia) = p_ano and origem <> 'transferencia'
  )
  select
    cr.id as categoria_id,
    cat.nome as categoria_nome,
    m.mes,
    coalesce(o.valor_centavos, 0) as orcado_centavos,
    coalesce((
      select sum(l.valor_centavos) from financeiro.lancamentos l
      where l.categoria_id = cr.id and l.origem <> 'transferencia'
        and date_trunc('month', l.data_competencia)::date = m.mes
    ), 0) as realizado_centavos,
    (o.valor_centavos is not null) as tem_orcamento
  from categorias_relevantes cr
  join financeiro.categorias cat on cat.id = cr.id
  cross join meses_ano m
  left join financeiro.orcamentos o on o.categoria_id = cr.id and o.competencia = m.mes
  order by cat.nome, m.mes;
$$;

revoke all on function financeiro.fn_orcamento_realizado(int) from public;
grant execute on function financeiro.fn_orcamento_realizado(int) to authenticated;
