-- 0115_E04-S06_custos_rentabilidade.sql
-- Custo/hora por funcionário (vigência) + rentabilidade por cliente/mês (receita − custo real).
-- Task 1 (obrigatória, feita antes desta migration): chaves reais confirmadas por query read-only
-- em produção — pcm.ordens_servico.auvo_detalhes->>'duracaoHoras' (texto decimal, HORAS já
-- calculadas), tecnico_funcionario_id (coluna real, não jsonb), client_id, check_out_at/
-- data_agendada. pcm.despesas está VAZIA em produção (endpoint Auvo /expenses com bug 500,
-- chamado pendente com o suporte) — tratada como 0 com aviso honesto na UI, nunca erro.
--
-- fn_rentabilidade_cliente_mes é SECURITY DEFINER (não invoker) de propósito: Financeiro lê
-- pcm.* como Conformist (domain.md do épico) — um usuário com financeiro:leitura mas SEM
-- pcm:leitura ainda precisa ver rentabilidade (é dado financeiro, só nasce de fonte pcm). A RLS de
-- pcm.ordens_servico/despesas seria bloqueio incorreto aqui; a checagem de permissão financeira é
-- manual no corpo da função (mesmo padrão das RPCs de config.*).
--
-- Reverso:
--   drop function if exists financeiro.fn_custo_os_por_cliente_mes(uuid, date);
--   drop function if exists financeiro.fn_rentabilidade_cliente_mes(int);
--   drop function if exists financeiro._fn_custo_hora_funcionario(uuid, date);
--   drop table if exists financeiro.custos_funcionario;

create table financeiro.custos_funcionario (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references pcm.funcionarios (id),
  custo_mensal_centavos integer not null check (custo_mensal_centavos > 0),
  horas_mes_base numeric(5, 1) not null default 220.0 check (horas_mes_base > 0),
  vigente_desde date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_by uuid references auth.users (id),
  unique (funcionario_id, vigente_desde)
);

create index idx_custos_funcionario_funcionario on financeiro.custos_funcionario (funcionario_id);

alter table financeiro.custos_funcionario enable row level security;
alter table financeiro.custos_funcionario force row level security;
grant select on financeiro.custos_funcionario to authenticated;
grant insert, update, delete on financeiro.custos_funcionario to authenticated;
grant select, insert, update, delete on financeiro.custos_funcionario to service_role;

create policy "custos_funcionario_select_financeiro" on financeiro.custos_funcionario for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
create policy "custos_funcionario_insert_financeiro" on financeiro.custos_funcionario for insert to authenticated
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "custos_funcionario_update_financeiro" on financeiro.custos_funcionario for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "custos_funcionario_delete_financeiro" on financeiro.custos_funcionario for delete to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');

-- R$/hora vigente numa data: maior vigente_desde <= data. NULL = funcionário sem custo cadastrado
-- (horas dele entram como "não valoradas", nunca custo 0 silencioso — AC-6).
create or replace function financeiro._fn_custo_hora_funcionario(p_funcionario_id uuid, p_data date)
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
      sum(oc.despesa_centavos) as custo_despesas_centavos
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

-- Drill-down por OS (AC-5): mesmo cálculo, granular por OS de um cliente/mês.
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
  if not (
    (auth.jwt() ->> 'user_role') = 'superadmin'
    or (auth.jwt() -> 'user_modulos' ->> 'financeiro') in ('leitura', 'escrita')
  ) then
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
    coalesce((os.auvo_detalhes ->> 'duracaoHoras')::numeric, 0) as horas,
    financeiro._fn_custo_hora_funcionario(
      os.tecnico_funcionario_id, coalesce(os.check_out_at::date, os.data_agendada::date)
    ) as custo_hora_reais,
    round(
      coalesce((os.auvo_detalhes ->> 'duracaoHoras')::numeric, 0)
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

revoke all on function financeiro.fn_custo_os_por_cliente_mes(uuid, date) from public;
grant execute on function financeiro.fn_custo_os_por_cliente_mes(uuid, date) to authenticated;

comment on function financeiro.fn_rentabilidade_cliente_mes(int) is 'E04-S06: receita (financeiro.lancamentos) − custo real (horas Auvo × R$/h do funcionário + despesas pcm.despesas) por cliente/mês. security definer com checagem manual de financeiro:leitura — Financeiro é Conformist de pcm (lê independente do módulo pcm do chamador).';
comment on function financeiro.fn_custo_os_por_cliente_mes(uuid, date) is 'E04-S06: drill-down por OS do cálculo de fn_rentabilidade_cliente_mes (AC-5).';
