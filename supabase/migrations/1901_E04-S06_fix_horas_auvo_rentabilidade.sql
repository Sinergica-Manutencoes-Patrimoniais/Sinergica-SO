-- 1901_E04-S06_fix_horas_auvo_rentabilidade.sql — Sinérgica SO
--
-- DEF-06 (Financeiro > Rentabilidade não carrega). `os.auvo_detalhes` é payload livre vindo do
-- Auvo: o valor de `duracaoHoras` é texto, não número. `(auvo_detalhes ->> 'duracaoHoras')::numeric`
-- aborta a RPC inteira com 22P02 ("invalid input syntax for type numeric") assim que UMA OS
-- finalizada no período traz string vazia, decimal com vírgula ou qualquer texto. Como a função
-- varre todas as OS finalizadas dos últimos 12 meses, uma única linha ruim derruba a tela para
-- todos os clientes, e "Tentar novamente" reproduz — exatamente o relatado.
--
-- `fn_custo_os_por_cliente_mes` (drill-down da mesma tela, AC-5) faz o mesmo cast três vezes e
-- cai pelo mesmo motivo.
--
-- Comportamento preservado: valor ausente já contava como 0 hora (`coalesce(..., 0)`); valor
-- não numérico passa a contar como 0 hora também, em vez de abortar. Nenhuma regra nova de
-- interpretação — "2,5" NÃO vira 2.5, porque converter vírgula decimal seria inventar leitura
-- sobre dado de terceiro.
--
-- Reverso: reaplicar as definições de 0149_security_db_ci_hardening.sql para as duas funções e
--   drop function if exists financeiro._fn_horas_auvo(jsonb);

-- Horas de uma OS a partir do payload do Auvo. Devolve 0 quando ausente OU não numérico.
create or replace function financeiro._fn_horas_auvo(p_auvo_detalhes jsonb)
returns numeric
language sql
immutable
set search_path = pg_temp
as $$
  select case
    when (p_auvo_detalhes ->> 'duracaoHoras') ~ '^\s*-?\d+(\.\d+)?\s*$'
      then (p_auvo_detalhes ->> 'duracaoHoras')::numeric
    else 0
  end;
$$;

comment on function financeiro._fn_horas_auvo(jsonb) is
  'DEF-06: extrai duracaoHoras do payload do Auvo sem abortar a consulta quando o texto não é numérico (0 hora, igual ao valor ausente).';

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
  if coalesce(
    (auth.jwt() ->> 'user_role') = 'superadmin'
    or (auth.jwt() -> 'user_modulos' ->> 'financeiro') in ('leitura', 'escrita'),
    false
  ) is not true then
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
      financeiro._fn_horas_auvo(os.auvo_detalhes) as horas,
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

create or replace function financeiro.fn_custo_os_por_cliente_mes(p_cliente_id uuid, p_mes date)
returns table (
  os_id uuid,
  numero text,
  data date,
  tecnico_funcionario_id uuid,
  horas numeric,
  custo_hora_reais numeric,
  custo_mo_centavos bigint,
  despesa_centavos bigint,
  valorado boolean
)
language plpgsql
stable
security definer
set search_path = financeiro, pcm, pg_temp
as $$
begin
  if coalesce(
    (auth.jwt() ->> 'user_role') = 'superadmin'
    or (auth.jwt() -> 'user_modulos' ->> 'financeiro') in ('leitura', 'escrita'),
    false
  ) is not true then
    raise exception 'permission denied for function fn_custo_os_por_cliente_mes' using errcode = '42501';
  end if;

  return query
  with despesas_por_task as (
    select auvo_task_id, sum(valor_centavos) as total_despesa_centavos
    from pcm.despesas
    where auvo_task_id is not null
    group by auvo_task_id
  )
  select
    os.id as os_id,
    os.numero,
    coalesce(os.check_out_at::date, os.data_agendada::date) as data,
    os.tecnico_funcionario_id,
    financeiro._fn_horas_auvo(os.auvo_detalhes) as horas,
    financeiro._fn_custo_hora_funcionario(
      os.tecnico_funcionario_id, coalesce(os.check_out_at::date, os.data_agendada::date)
    ) as custo_hora_reais,
    round(
      financeiro._fn_horas_auvo(os.auvo_detalhes)
      * coalesce(financeiro._fn_custo_hora_funcionario(
          os.tecnico_funcionario_id, coalesce(os.check_out_at::date, os.data_agendada::date)
        ), 0) * 100
    )::bigint as custo_mo_centavos,
    coalesce(desp.total_despesa_centavos, 0) as despesa_centavos,
    financeiro._fn_custo_hora_funcionario(
      os.tecnico_funcionario_id, coalesce(os.check_out_at::date, os.data_agendada::date)
    ) is not null as valorado
  from pcm.ordens_servico os
  left join despesas_por_task desp on desp.auvo_task_id = os.auvo_task_id
  where os.status = 'finalizado'
    and os.deleted_at is null
    and os.client_id = p_cliente_id
    and date_trunc('month', coalesce(os.check_out_at::date, os.data_agendada::date))::date = date_trunc('month', p_mes)::date
  order by data;
end;
$$;

revoke all on function financeiro._fn_horas_auvo(jsonb) from public;
grant execute on function financeiro._fn_horas_auvo(jsonb) to authenticated, service_role;
revoke all on function financeiro.fn_rentabilidade_cliente_mes(int) from public;
grant execute on function financeiro.fn_rentabilidade_cliente_mes(int) to authenticated;
revoke all on function financeiro.fn_custo_os_por_cliente_mes(uuid, date) from public;
grant execute on function financeiro.fn_custo_os_por_cliente_mes(uuid, date) to authenticated;
