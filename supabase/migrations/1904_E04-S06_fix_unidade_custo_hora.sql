-- 1904_E04-S06_fix_unidade_custo_hora.sql — Sinérgica SO
--
-- DEF-23: `financeiro._fn_custo_hora_funcionario` devolve CENTAVOS por hora
-- (`custo_mensal_centavos::numeric / horas_mes_base`, migration 0115) e era consumida como se
-- fossem REAIS por hora: a rentabilidade apelidava o retorno de `custo_hora_reais` e multiplicava
-- por 100 para "converter em centavos". O custo de mão de obra saía 100 vezes maior do que o real.
--
-- R$ 5.000/mês com 200 h base = R$ 25,00/hora. A função devolve 2500 (centavos). Uma OS de 2 h
-- custa R$ 50,00 = 5000 centavos; a conta antiga gravava 500000 centavos, R$ 5.000,00.
--
-- Corrigido na origem, não no consumo, e em centavos do começo ao fim — sem conversão no meio:
--   * o cálculo ponto-no-tempo passa a se chamar `financeiro._fn_custo_hora_centavos_funcionario`,
--     nome que diz a unidade; a antiga `_fn_custo_hora_funcionario` é removida para não sobrar
--     caminho ambíguo;
--   * `fn_rentabilidade_cliente_mes` e `fn_custo_os_por_cliente_mes` perdem o `* 100`;
--   * a coluna `custo_hora_reais` do drill-down vira `custo_hora_centavos`;
--   * `fn_custo_hora_medio_por_cargo` (E03-S03, o terceiro consumidor, que já tratava o valor
--     como centavos e portanto já estava certo) é reemitida só para apontar ao novo nome.
--
-- Efeito na tela: em Financeiro > Rentabilidade, o custo de mão de obra e o custo por OS passam a
-- aparecer 100 vezes MENORES, e a margem, maior. O número novo é o certo; o antigo estava inflado.
-- Nenhum dado gravado muda — as duas funções são de leitura e nada é persistido a partir delas.
--
-- Reverso: reaplicar as definições de 1901 (rentabilidade e drill-down) e de 0181
--   (fn_custo_hora_medio_por_cargo), recriar `financeiro._fn_custo_hora_funcionario` como em 0115
--   e
--   drop function if exists financeiro._fn_custo_hora_centavos_funcionario(uuid, date);

-- Centavos/hora vigentes numa data: maior vigente_desde <= data. NULL = funcionário sem custo
-- cadastrado (as horas dele entram como "não valoradas", nunca custo 0 silencioso — AC-6).
create or replace function financeiro._fn_custo_hora_centavos_funcionario(p_funcionario_id uuid, p_data date)
returns numeric
language sql
stable
security definer
set search_path = financeiro, pg_temp
as $$
  select cf.custo_mensal_centavos::numeric / cf.horas_mes_base
  from financeiro.custos_funcionario cf
  where cf.funcionario_id = p_funcionario_id
    and cf.vigente_desde <= p_data
  order by cf.vigente_desde desc
  limit 1;
$$;

comment on function financeiro._fn_custo_hora_centavos_funcionario(uuid, date) is
  'DEF-23: custo por hora do funcionário em CENTAVOS na data (custo_mensal_centavos / horas_mes_base). Substitui _fn_custo_hora_funcionario, cujo retorno era lido como reais.';

create or replace function financeiro.fn_custo_hora_medio_por_cargo(p_cargo text)
returns numeric
language plpgsql
stable
security definer
set search_path = financeiro, pcm, pg_temp
as $$
declare
  v_media numeric;
begin
  if coalesce(
    (auth.jwt() ->> 'user_role') = 'superadmin'
    or (auth.jwt() -> 'user_modulos' ->> 'comercial') in ('leitura', 'escrita')
    or (auth.jwt() -> 'user_modulos' ->> 'financeiro') in ('leitura', 'escrita'),
    false
  ) is not true then
    raise exception 'permission denied for function fn_custo_hora_medio_por_cargo'
      using errcode = '42501';
  end if;

  if p_cargo is null or btrim(p_cargo) = '' then
    return null;
  end if;

  select avg(financeiro._fn_custo_hora_centavos_funcionario(f.id, current_date))
    into v_media
  from pcm.funcionarios f
  where f.cargo = p_cargo
    and f.ativo
    and f.deleted_at is null;

  return v_media;  -- centavos/hora; null quando nenhum funcionário do cargo tem custo vigente
end;
$$;

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
      financeiro._fn_custo_hora_centavos_funcionario(
        os.tecnico_funcionario_id,
        coalesce(os.check_out_at::date, os.data_agendada::date)
      ) as custo_hora_centavos,
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
      sum(oc.horas) filter (where oc.custo_hora_centavos is not null) as horas_valoradas,
      round(sum(oc.horas * coalesce(oc.custo_hora_centavos, 0)))::bigint as custo_mo_centavos,
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

-- `create or replace` não troca o nome de coluna do `returns table`: drop e recria (os grants
-- são reemitidos no fim deste arquivo).
drop function if exists financeiro.fn_custo_os_por_cliente_mes(uuid, date);
create function financeiro.fn_custo_os_por_cliente_mes(p_cliente_id uuid, p_mes date)
returns table (
  os_id uuid,
  numero text,
  data date,
  tecnico_funcionario_id uuid,
  horas numeric,
  custo_hora_centavos numeric,
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
    financeiro._fn_custo_hora_centavos_funcionario(
      os.tecnico_funcionario_id, coalesce(os.check_out_at::date, os.data_agendada::date)
    ) as custo_hora_centavos,
    round(
      financeiro._fn_horas_auvo(os.auvo_detalhes)
      * coalesce(financeiro._fn_custo_hora_centavos_funcionario(
          os.tecnico_funcionario_id, coalesce(os.check_out_at::date, os.data_agendada::date)
        ), 0)
    )::bigint as custo_mo_centavos,
    coalesce(desp.total_despesa_centavos, 0) as despesa_centavos,
    financeiro._fn_custo_hora_centavos_funcionario(
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

-- O nome antigo sai de circulação: nenhuma função do repositório o chama mais.
drop function if exists financeiro._fn_custo_hora_funcionario(uuid, date);

revoke all on function financeiro._fn_custo_hora_centavos_funcionario(uuid, date) from public;
grant execute on function financeiro._fn_custo_hora_centavos_funcionario(uuid, date) to authenticated, service_role;
revoke all on function financeiro.fn_custo_os_por_cliente_mes(uuid, date) from public;
grant execute on function financeiro.fn_custo_os_por_cliente_mes(uuid, date) to authenticated;
revoke all on function financeiro.fn_custo_hora_medio_por_cargo(text) from public;
grant execute on function financeiro.fn_custo_hora_medio_por_cargo(text) to authenticated;
