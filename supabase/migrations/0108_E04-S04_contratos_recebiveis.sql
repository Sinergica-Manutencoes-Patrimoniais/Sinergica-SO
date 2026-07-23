-- 0108_E04-S04_contratos_recebiveis.sql
-- Contratos (receita recorrente por cliente), geração idempotente de recebíveis previstos
-- (financeiro.fn_gerar_recorrencias, chamada pelo botão da UI e pelo pg_cron do dia 1) e view de
-- aging de recebíveis (D+3/7/15). Design: specs/E04-S01-fundacao-financeiro/design.md §S04/D-4/D-5.
-- Reverso:
--   select cron.unschedule('financeiro_gerar_recorrencias_mensal');
--   drop view if exists financeiro.aging_recebiveis;
--   drop function if exists financeiro.fn_gerar_recorrencias(date);
--   drop index if exists financeiro.lancamentos_contrato_competencia_recorrencia_uidx;
--   alter table financeiro.lancamentos drop constraint if exists lancamentos_contrato_id_fkey;
--   drop table if exists financeiro.contratos;

create table financeiro.contratos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references pcm.clientes (id),
  descricao text,
  valor_mensal_centavos integer not null check (valor_mensal_centavos > 0),
  dia_vencimento integer not null check (dia_vencimento between 1 and 28),
  inicio date not null,
  fim date,
  status text not null default 'ativo' check (status in ('ativo', 'suspenso', 'encerrado')),
  bloqueia_os_em_atraso boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_by uuid references auth.users (id)
);

create index idx_contratos_cliente on financeiro.contratos (cliente_id);
create index idx_contratos_status on financeiro.contratos (status);

alter table financeiro.contratos enable row level security;
alter table financeiro.contratos force row level security;
grant select on financeiro.contratos to authenticated;
grant insert, update, delete on financeiro.contratos to authenticated;
grant select, insert, update, delete on financeiro.contratos to service_role;

create policy "contratos_select_financeiro" on financeiro.contratos for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
create policy "contratos_insert_financeiro" on financeiro.contratos for insert to authenticated
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "contratos_update_financeiro" on financeiro.contratos for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "contratos_delete_financeiro" on financeiro.contratos for delete to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');

-- FK adiada da S01 (contrato_id uuid solto). NOT VALID aqui; VALIDATE em 0109, migration separada
-- (padrão da casa — evita lock longo na mesma transação, ver 0101/0102).
alter table financeiro.lancamentos
  add constraint lancamentos_contrato_id_fkey
  foreign key (contrato_id) references financeiro.contratos (id) not valid;

-- Idempotência da geração: 1 recebível por contrato por competência.
create unique index lancamentos_contrato_competencia_recorrencia_uidx
  on financeiro.lancamentos (contrato_id, data_competencia)
  where origem = 'recorrencia';

-- security invoker (não definer): chamada via pg_cron roda como o role que agendou o job
-- (postgres, bypassa RLS como qualquer superuser); chamada pelo botão da UI roda como o usuário
-- autenticado — a RLS de insert em financeiro.lancamentos já exige financeiro:escrita, sem
-- duplicar a checagem aqui dentro (mesmo raciocínio de pcm.fn_kpis_ordens_servico, 0076).
create or replace function financeiro.fn_gerar_recorrencias(p_competencia date)
returns integer
language plpgsql
security invoker
set search_path = financeiro, pg_temp
as $$
declare
  v_competencia date := date_trunc('month', p_competencia)::date;
  v_fim_mes date := (date_trunc('month', p_competencia) + interval '1 month' - interval '1 day')::date;
  v_categoria_id uuid;
  v_criados integer;
begin
  select id into v_categoria_id
  from financeiro.categorias
  where nome = 'Receita de contrato' and parent_id is null
  limit 1;

  insert into financeiro.lancamentos (
    tipo, status, valor_centavos, data_competencia, data_vencimento,
    categoria_id, cliente_id, contrato_id, origem
  )
  select
    'entrada',
    'previsto',
    c.valor_mensal_centavos,
    v_competencia,
    v_competencia + (c.dia_vencimento - 1),
    v_categoria_id,
    c.cliente_id,
    c.id,
    'recorrencia'
  from financeiro.contratos c
  where c.status = 'ativo'
    and c.inicio <= v_fim_mes
    and (c.fim is null or c.fim >= v_competencia)
  on conflict (contrato_id, data_competencia) where (origem = 'recorrencia') do nothing;

  get diagnostics v_criados = row_count;
  return v_criados;
end;
$$;

revoke all on function financeiro.fn_gerar_recorrencias(date) from public;
grant execute on function financeiro.fn_gerar_recorrencias(date) to authenticated;

comment on function financeiro.fn_gerar_recorrencias(date)
  is 'E04-S04: gera 1 recebível previsto por contrato ativo vigente na competência. Idempotente (unique parcial contrato_id+data_competencia); rodar de novo não duplica.';

-- Aging de recebíveis — security_invoker=on: a view respeita a RLS de quem consulta, não a de
-- quem criou a view (padrão de view sobre tabela RLS FORCE deste repo).
create view financeiro.aging_recebiveis
with (security_invoker = on) as
select
  l.id as lancamento_id,
  l.cliente_id,
  l.contrato_id,
  l.valor_centavos,
  l.data_vencimento,
  l.descricao,
  case
    when l.data_vencimento >= current_date then 'a_vencer'
    when current_date - l.data_vencimento between 1 and 3 then 'd1_3'
    when current_date - l.data_vencimento between 4 and 7 then 'd4_7'
    when current_date - l.data_vencimento between 8 and 15 then 'd8_15'
    else 'd15_mais'
  end as faixa,
  greatest(current_date - l.data_vencimento, 0) as dias_atraso
from financeiro.lancamentos l
where l.tipo = 'entrada'
  and l.status = 'previsto'
  and l.data_vencimento is not null;

-- Dia 1 de cada mês, 03:05 UTC (fuso confortável pra não colidir com outros crons do projeto).
-- `cron.schedule` é idempotente por jobname — reaplicar a migration atualiza, não duplica.
select cron.schedule(
  'financeiro_gerar_recorrencias_mensal',
  '5 3 1 * *',
  $$select financeiro.fn_gerar_recorrencias(current_date);$$
);

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select jobid, jobname, schedule, command from cron.job where jobname = 'financeiro_gerar_recorrencias_mensal';
-- select financeiro.fn_gerar_recorrencias(current_date); -- disparo manual de teste
