-- 0124_E04-S11_fechamento_mensal.sql
-- Fechamento mensal (AC-2/AC-3): trava escrita em `financeiro.lancamentos` cuja `data_competencia`
-- caia num mês `fechado`. `financeiro.fechamentos_mensais` guarda o status atual por competência;
-- `financeiro.fechamentos_eventos` é o log append-only (quem/quando/porquê fechou ou reabriu — só
-- INSERT/SELECT, igual ao padrão já usado em `lancamentos_eventos`/`regua_envios`). A trava é um
-- trigger BEFORE INSERT/UPDATE/DELETE em `financeiro.lancamentos` — vale pra TODO mundo, inclusive
-- `service_role` (webhook de cobrança, régua, provisão de imposto): um mês fechado é fechado de
-- verdade, precisa reabrir explicitamente pra qualquer escrita retroativa (é o comportamento
-- pedido pela spec — "trava o período"). Exportação (AC-1/AC-4) não precisa de migration: lê
-- `financeiro.lancamentos` com a mesma query/RLS de `listarLancamentos` já existente (S01), CSV
-- gerado client-side.
-- Reverso:
--   drop trigger if exists trg_lancamentos_bloqueio_mes_fechado on financeiro.lancamentos;
--   drop function if exists financeiro.fn_bloquear_lancamento_mes_fechado();
--   drop function if exists financeiro.fn_reabrir_mes(date, text);
--   drop function if exists financeiro.fn_fechar_mes(date, text);
--   drop table if exists financeiro.fechamentos_eventos;
--   drop table if exists financeiro.fechamentos_mensais;

create table financeiro.fechamentos_mensais (
  competencia date primary key,
  status text not null default 'aberto' check (status in ('aberto', 'fechado')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

alter table financeiro.fechamentos_mensais enable row level security;
alter table financeiro.fechamentos_mensais force row level security;
grant select on financeiro.fechamentos_mensais to authenticated;
grant select, insert, update, delete on financeiro.fechamentos_mensais to service_role;

create policy "fechamentos_mensais_select_financeiro" on financeiro.fechamentos_mensais for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
-- sem policy de insert/update pra `authenticated` — só as RPCs `fn_fechar_mes`/`fn_reabrir_mes`
-- (security definer) escrevem, cada uma com sua própria checagem de papel.

create table financeiro.fechamentos_eventos (
  id uuid primary key default gen_random_uuid(),
  competencia date not null,
  acao text not null check (acao in ('fechar', 'reabrir')),
  motivo text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);

create index idx_fechamentos_eventos_competencia on financeiro.fechamentos_eventos (competencia);

alter table financeiro.fechamentos_eventos enable row level security;
alter table financeiro.fechamentos_eventos force row level security;
grant select on financeiro.fechamentos_eventos to authenticated;
grant select, insert, update, delete on financeiro.fechamentos_eventos to service_role;

create policy "fechamentos_eventos_select_financeiro" on financeiro.fechamentos_eventos for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
-- sem policy de insert/update/delete pra `authenticated` — append-only, só via RPC.

-- AC-2: fecha o mês — qualquer `financeiro:escrita` (revisão do mês é trabalho operacional, não
-- exige superadmin; a parte sensível é REABRIR, guardada abaixo).
create or replace function financeiro.fn_fechar_mes(p_competencia date, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = financeiro, pg_temp
as $$
declare
  v_competencia date := date_trunc('month', p_competencia)::date;
begin
  if (auth.jwt() ->> 'user_role') is distinct from 'superadmin'
     and (auth.jwt() -> 'user_modulos' ->> 'financeiro') is distinct from 'escrita' then
    raise exception 'Sem permissão de escrita no Financeiro' using errcode = '42501';
  end if;

  insert into financeiro.fechamentos_mensais (competencia, status, updated_at, updated_by)
  values (v_competencia, 'fechado', now(), auth.uid())
  on conflict (competencia) do update set status = 'fechado', updated_at = now(), updated_by = auth.uid();

  insert into financeiro.fechamentos_eventos (competencia, acao, motivo)
  values (v_competencia, 'fechar', p_motivo);
end;
$$;

revoke all on function financeiro.fn_fechar_mes(date, text) from public;
grant execute on function financeiro.fn_fechar_mes(date, text) to authenticated;

-- AC-3: reabre o mês — só superadmin, motivo obrigatório (auditável).
create or replace function financeiro.fn_reabrir_mes(p_competencia date, p_motivo text)
returns void
language plpgsql
security definer
set search_path = financeiro, pg_temp
as $$
declare
  v_competencia date := date_trunc('month', p_competencia)::date;
begin
  if (auth.jwt() ->> 'user_role') is distinct from 'superadmin' then
    raise exception 'Apenas superadmin pode reabrir um mês fechado' using errcode = '42501';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Motivo da reabertura é obrigatório (auditável)' using errcode = '22023';
  end if;

  update financeiro.fechamentos_mensais
  set status = 'aberto', updated_at = now(), updated_by = auth.uid()
  where competencia = v_competencia;

  insert into financeiro.fechamentos_eventos (competencia, acao, motivo)
  values (v_competencia, 'reabrir', p_motivo);
end;
$$;

revoke all on function financeiro.fn_reabrir_mes(date, text) from public;
grant execute on function financeiro.fn_reabrir_mes(date, text) to authenticated;

-- AC-2: guarda de mês fechado — vale pra INSERT/UPDATE/DELETE, TODO chamador (inclusive
-- service_role: webhook de cobrança, régua, provisão de imposto). `security definer` porque
-- authenticated não tem select direto em `fechamentos_mensais` restrito (tem, via policy acima),
-- mas mantém consistência com o resto do arquivo.
create or replace function financeiro.fn_bloquear_lancamento_mes_fechado()
returns trigger
language plpgsql
security definer
set search_path = financeiro, pg_temp
as $$
declare
  v_competencia date;
begin
  v_competencia := date_trunc('month', coalesce(new.data_competencia, old.data_competencia))::date;
  if exists (select 1 from financeiro.fechamentos_mensais f where f.competencia = v_competencia and f.status = 'fechado') then
    raise exception 'Competência % está fechada — reabra o mês antes de editar (Financeiro > Fechamento).',
      to_char(v_competencia, 'MM/YYYY') using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' and old.data_competencia is distinct from new.data_competencia then
    if exists (
      select 1 from financeiro.fechamentos_mensais f
      where f.competencia = date_trunc('month', old.data_competencia)::date and f.status = 'fechado'
    ) then
      raise exception 'Competência de origem está fechada — não é possível mover o lançamento.' using errcode = '22023';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_lancamentos_bloqueio_mes_fechado
  before insert or update or delete on financeiro.lancamentos
  for each row execute function financeiro.fn_bloquear_lancamento_mes_fechado();
