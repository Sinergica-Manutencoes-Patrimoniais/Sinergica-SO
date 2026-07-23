-- 0107_E04-S03_rpcs_dashboard_caixa.sql
-- RPCs de agregação server-side pro Dashboard Financeiro — nunca baixar a tabela de lançamentos
-- inteira pro browser (mesmo antipadrão eliminado em pcm.fn_kpis_ordens_servico, 0076_E01-S44).
-- SEM security definer: security invoker deixa a RLS FORCE de financeiro.* filtrar sozinha por
-- user_modulos.financeiro, sem duplicar checagem de permissão aqui dentro.
-- Reverso:
--   drop function if exists financeiro.fn_gastos_categoria(date, date);
--   drop function if exists financeiro.fn_fluxo_mensal(int);
--   drop function if exists financeiro.fn_resumo_caixa();

create or replace function financeiro.fn_resumo_caixa()
returns table (
  posicao_caixa_centavos bigint,
  entradas_mes_centavos bigint,
  saidas_mes_centavos bigint,
  resultado_mes_centavos bigint,
  a_receber_30d_centavos bigint,
  a_pagar_30d_centavos bigint,
  entradas_previstas_mes_centavos bigint,
  saidas_previstas_mes_centavos bigint
)
language sql
stable
security invoker
set search_path = financeiro, pg_temp
as $$
  select
    (
      select coalesce(sum(
        cb.saldo_inicial_centavos
        + coalesce((
            select sum(case when l.tipo = 'entrada' then l.valor_centavos else -l.valor_centavos end)
            from financeiro.lancamentos l
            where l.conta_id = cb.id
              and l.status = 'realizado'
              and l.data_pagamento >= cb.saldo_inicial_em
          ), 0)
      ), 0)
      from financeiro.contas_bancarias cb
      where cb.ativo
    ) as posicao_caixa_centavos,
    coalesce((
      select sum(valor_centavos) from financeiro.lancamentos
      where tipo = 'entrada' and status = 'realizado'
        and data_pagamento >= date_trunc('month', current_date)::date
        and data_pagamento < (date_trunc('month', current_date) + interval '1 month')::date
    ), 0) as entradas_mes_centavos,
    coalesce((
      select sum(valor_centavos) from financeiro.lancamentos
      where tipo = 'saida' and status = 'realizado'
        and data_pagamento >= date_trunc('month', current_date)::date
        and data_pagamento < (date_trunc('month', current_date) + interval '1 month')::date
    ), 0) as saidas_mes_centavos,
    coalesce((
      select sum(case when tipo = 'entrada' then valor_centavos else -valor_centavos end)
      from financeiro.lancamentos
      where status = 'realizado'
        and data_pagamento >= date_trunc('month', current_date)::date
        and data_pagamento < (date_trunc('month', current_date) + interval '1 month')::date
    ), 0) as resultado_mes_centavos,
    coalesce((
      select sum(valor_centavos) from financeiro.lancamentos
      where tipo = 'entrada' and status = 'previsto'
        and data_vencimento between current_date and current_date + 30
    ), 0) as a_receber_30d_centavos,
    coalesce((
      select sum(valor_centavos) from financeiro.lancamentos
      where tipo = 'saida' and status = 'previsto'
        and data_vencimento between current_date and current_date + 30
    ), 0) as a_pagar_30d_centavos,
    coalesce((
      select sum(valor_centavos) from financeiro.lancamentos
      where tipo = 'entrada' and status = 'previsto'
        and data_vencimento >= date_trunc('month', current_date)::date
        and data_vencimento < (date_trunc('month', current_date) + interval '1 month')::date
    ), 0) as entradas_previstas_mes_centavos,
    coalesce((
      select sum(valor_centavos) from financeiro.lancamentos
      where tipo = 'saida' and status = 'previsto'
        and data_vencimento >= date_trunc('month', current_date)::date
        and data_vencimento < (date_trunc('month', current_date) + interval '1 month')::date
    ), 0) as saidas_previstas_mes_centavos;
$$;

revoke all on function financeiro.fn_resumo_caixa() from public;
grant execute on function financeiro.fn_resumo_caixa() to authenticated;

create or replace function financeiro.fn_fluxo_mensal(p_meses int default 12)
returns table (
  mes date,
  entradas_centavos bigint,
  saidas_centavos bigint,
  resultado_centavos bigint
)
language sql
stable
security invoker
set search_path = financeiro, pg_temp
as $$
  with meses as (
    select date_trunc('month', current_date)::date - (n || ' month')::interval as mes
    from generate_series(0, greatest(p_meses, 1) - 1) as n
  ),
  agregado as (
    select
      date_trunc('month', data_competencia)::date as mes,
      sum(valor_centavos) filter (where tipo = 'entrada') as entradas,
      sum(valor_centavos) filter (where tipo = 'saida') as saidas
    from financeiro.lancamentos
    where status = 'realizado'
      and data_competencia >= (date_trunc('month', current_date) - (greatest(p_meses, 1) - 1 || ' month')::interval)::date
    group by 1
  )
  select
    m.mes::date,
    coalesce(a.entradas, 0) as entradas_centavos,
    coalesce(a.saidas, 0) as saidas_centavos,
    coalesce(a.entradas, 0) - coalesce(a.saidas, 0) as resultado_centavos
  from meses m
  left join agregado a on a.mes = m.mes
  order by m.mes;
$$;

revoke all on function financeiro.fn_fluxo_mensal(int) from public;
grant execute on function financeiro.fn_fluxo_mensal(int) to authenticated;

create or replace function financeiro.fn_gastos_categoria(p_inicio date, p_fim date)
returns table (
  categoria_id uuid,
  total_centavos bigint
)
language sql
stable
security invoker
set search_path = financeiro, pg_temp
as $$
  select categoria_id, sum(valor_centavos) as total_centavos
  from financeiro.lancamentos
  where tipo = 'saida'
    and status = 'realizado'
    and data_competencia between p_inicio and p_fim
  group by categoria_id;
$$;

revoke all on function financeiro.fn_gastos_categoria(date, date) from public;
grant execute on function financeiro.fn_gastos_categoria(date, date) to authenticated;

comment on function financeiro.fn_resumo_caixa() is 'E04-S03: KPIs do topo do Dashboard Financeiro — posição de caixa, entradas/saídas/resultado do mês (data_pagamento), a receber/pagar 30d (data_vencimento). security invoker: RLS de financeiro.* filtra por user_modulos.financeiro.';
comment on function financeiro.fn_fluxo_mensal(int) is 'E04-S03: série mensal de entradas/saídas/resultado (competência), últimos N meses, zero-preenchido.';
comment on function financeiro.fn_gastos_categoria(date, date) is 'E04-S03: total de saídas realizadas por categoria no período (competência) — front agrega raiz+subcategorias.';
