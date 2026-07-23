-- 0116_E04-S06_fix_tipo_despesas_rentabilidade.sql
-- Bug real achado via Playwright contra produção: `sum()` de uma coluna já bigint (como
-- oc.despesa_centavos, ela própria coalesce de um sum(integer)) devolve NUMERIC no Postgres, não
-- BIGINT — batia com "structure of query does not match function result type" (42804, coluna 5:
-- custo_despesas_centavos) sempre que a RPC rodava. Fix: cast explícito ::bigint na agregação.
-- Reverso: nenhum (create or replace idempotente; reverter = reaplicar a versão de 0115).

create or replace function financeiro.fn_rentabilidade_cliente_mes(p_meses int default 12)
returns table (
  cliente_id uuid,
  mes date,
  receita_centavos bigint,
  custo_mo_centavos bigint,
  custo_despesas_centavos bigint,
  horas_totais numeric,
  horas_valoradas numeric,
  margem_centavos bigint,
  margem_percentual numeric
)
language plpgsql
stable
security definer
set search_path = financeiro, pcm, pg_temp
as $$
declare
  v_desde date := (date_trunc('month', current_date) - (greatest(p_meses, 1) - 1 || ' month')::interval)::date;
begin
  if not (
    (auth.jwt() ->> 'user_role') = 'superadmin'
    or (auth.jwt() -> 'user_modulos' ->> 'financeiro') in ('leitura', 'escrita')
  ) then
    raise exception 'permission denied for function fn_rentabilidade_cliente_mes' using errcode = '42501';
  end if;

  return query
  with despesas_por_task as (
    select auvo_task_id, sum(valor_centavos) as total_despesa_centavos
    from pcm.despesas
    where auvo_task_id is not null
    group by auvo_task_id
  ),
  os_custo as (
    select
      os.client_id,
      date_trunc('month', coalesce(os.check_out_at::date, os.data_agendada::date))::date as mes,
      coalesce((os.auvo_detalhes ->> 'duracaoHoras')::numeric, 0) as horas,
      financeiro._fn_custo_hora_funcionario(
        os.tecnico_funcionario_id,
        coalesce(os.check_out_at::date, os.data_agendada::date)
      ) as custo_hora_reais,
      coalesce(desp.total_despesa_centavos, 0) as despesa_centavos
    from pcm.ordens_servico os
    left join despesas_por_task desp on desp.auvo_task_id = os.auvo_task_id
    where os.status = 'finalizado'
      and os.deleted_at is null
      and coalesce(os.check_out_at::date, os.data_agendada::date) >= v_desde
      and os.client_id is not null
  ),
  custo_agregado as (
    select
      oc.client_id,
      oc.mes,
      sum(oc.horas) as horas_totais,
      sum(oc.horas) filter (where oc.custo_hora_reais is not null) as horas_valoradas,
      round(sum(oc.horas * coalesce(oc.custo_hora_reais, 0)) * 100)::bigint as custo_mo_centavos,
      sum(oc.despesa_centavos)::bigint as custo_despesas_centavos
    from os_custo oc
    group by oc.client_id, oc.mes
  ),
  receita_agregada as (
    select
      l.cliente_id as client_id,
      date_trunc('month', l.data_competencia)::date as mes,
      sum(l.valor_centavos) as receita_centavos
    from financeiro.lancamentos l
    where l.tipo = 'entrada' and l.status = 'realizado' and l.cliente_id is not null
      and l.data_competencia >= v_desde
    group by l.cliente_id, date_trunc('month', l.data_competencia)
  )
  select
    coalesce(ca.client_id, ra.client_id) as cliente_id,
    coalesce(ca.mes, ra.mes) as mes,
    coalesce(ra.receita_centavos, 0) as receita_centavos,
    coalesce(ca.custo_mo_centavos, 0) as custo_mo_centavos,
    coalesce(ca.custo_despesas_centavos, 0) as custo_despesas_centavos,
    coalesce(ca.horas_totais, 0) as horas_totais,
    coalesce(ca.horas_valoradas, 0) as horas_valoradas,
    coalesce(ra.receita_centavos, 0) - coalesce(ca.custo_mo_centavos, 0) - coalesce(ca.custo_despesas_centavos, 0) as margem_centavos,
    case
      when coalesce(ra.receita_centavos, 0) > 0
        then round(
          ((coalesce(ra.receita_centavos, 0) - coalesce(ca.custo_mo_centavos, 0) - coalesce(ca.custo_despesas_centavos, 0))::numeric
            / ra.receita_centavos) * 100, 1)
      else null
    end as margem_percentual
  from custo_agregado ca
  full outer join receita_agregada ra on ra.client_id = ca.client_id and ra.mes = ca.mes
  order by 1, 2;
end;
$$;

revoke all on function financeiro.fn_rentabilidade_cliente_mes(int) from public;
grant execute on function financeiro.fn_rentabilidade_cliente_mes(int) to authenticated;
