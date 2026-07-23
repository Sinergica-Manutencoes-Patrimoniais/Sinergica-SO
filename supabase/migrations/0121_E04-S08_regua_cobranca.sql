-- 0121_E04-S08_regua_cobranca.sql
-- Régua de cobrança ativa (AC-1..AC-5): pontos configuráveis (D-x/D+x, canal, mensagem-modelo),
-- log de envios append-ish (só o job escreve, via service_role — nunca a UI), RPC de leitura dos
-- recebíveis pendentes de lembrete (`fn_regua_pendentes`) + RPC de registro idempotente
-- (`fn_regua_registrar_envio`, unique lancamento+ponto evita duplicar — AC-3), e cron diário
-- disparando a Edge Function `financeiro-regua-cobranca-disparo` via `net.http_post` (mesmo padrão
-- de 0013_E01-S11, reusa os secrets do Vault já existentes — nenhum segredo novo).
-- Reverso:
--   select cron.unschedule('financeiro_regua_cobranca_diaria');
--   drop function if exists financeiro.fn_regua_cobranca_disparo_diario();
--   drop function if exists financeiro.fn_regua_registrar_envio(uuid, uuid, text, text, text);
--   drop function if exists financeiro.fn_regua_pendentes();
--   drop table if exists financeiro.regua_envios;
--   drop table if exists financeiro.regua_pontos;

create table financeiro.regua_pontos (
  id uuid primary key default gen_random_uuid(),
  dia_offset int not null,
  canal text not null check (canal in ('whatsapp', 'email', 'ambos')),
  mensagem_modelo text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

alter table financeiro.regua_pontos enable row level security;
alter table financeiro.regua_pontos force row level security;
grant select on financeiro.regua_pontos to authenticated;
grant insert, update, delete on financeiro.regua_pontos to authenticated;
grant select, insert, update, delete on financeiro.regua_pontos to service_role;

create policy "regua_pontos_select_financeiro" on financeiro.regua_pontos for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
create policy "regua_pontos_escrita_financeiro" on financeiro.regua_pontos for all to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');

-- AC-3: log de envios — só o job (service_role) grava; humanos só leem (histórico/auditoria).
create table financeiro.regua_envios (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references financeiro.lancamentos (id) on delete cascade,
  ponto_id uuid not null references financeiro.regua_pontos (id) on delete cascade,
  canal_efetivo text check (canal_efetivo in ('whatsapp', 'email')),
  status text not null check (status in ('enviado', 'erro', 'sem_canal')),
  motivo text,
  enviado_em timestamptz not null default now(),
  unique (lancamento_id, ponto_id)
);

create index idx_regua_envios_lancamento on financeiro.regua_envios (lancamento_id);

alter table financeiro.regua_envios enable row level security;
alter table financeiro.regua_envios force row level security;
grant select on financeiro.regua_envios to authenticated;
grant select, insert, update, delete on financeiro.regua_envios to service_role;

create policy "regua_envios_select_financeiro" on financeiro.regua_envios for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
-- sem policy de insert/update/delete pra `authenticated` — só o job (service_role, bypassa RLS) grava.

-- AC-2: recebíveis que atingiram algum ponto ativo da régua e ainda não têm envio registrado pra
-- aquele ponto. `security invoker`: sempre chamada pela Edge Function via service_role (bypassa RLS
-- de FORCE por BYPASSRLS do role, já com grant explícito nas 2 tabelas + pcm.clientes desde 0014).
create or replace function financeiro.fn_regua_pendentes()
returns table (
  lancamento_id uuid,
  ponto_id uuid,
  cliente_id uuid,
  cliente_nome text,
  contato_telefone text,
  contato_email text,
  valor_centavos bigint,
  data_vencimento date,
  canal text,
  mensagem_modelo text
)
language sql
stable
security invoker
set search_path = financeiro, pcm, pg_temp
as $$
  select
    l.id as lancamento_id,
    p.id as ponto_id,
    l.cliente_id,
    c.nome as cliente_nome,
    c.contato_telefone,
    c.contato_email,
    l.valor_centavos,
    l.data_vencimento,
    p.canal,
    p.mensagem_modelo
  from financeiro.lancamentos l
  join financeiro.regua_pontos p on p.ativo
  join pcm.clientes c on c.id = l.cliente_id
  where l.tipo = 'entrada'
    and l.status = 'previsto'
    and l.data_vencimento is not null
    and l.cliente_id is not null
    and (l.data_vencimento + (p.dia_offset || ' days')::interval)::date <= current_date
    and not exists (
      select 1 from financeiro.regua_envios e
      where e.lancamento_id = l.id and e.ponto_id = p.id
    );
$$;

revoke all on function financeiro.fn_regua_pendentes() from public;
grant execute on function financeiro.fn_regua_pendentes() to service_role;

comment on function financeiro.fn_regua_pendentes()
  is 'E04-S08 AC-2: recebíveis previstos que atingiram um ponto ativo da régua sem envio registrado. Só service_role (chamada pela Edge Function de disparo).';

-- AC-3: registro idempotente — `on conflict do nothing` garante nunca duplicar o mesmo ponto pro
-- mesmo lançamento, mesmo se o job rodar 2x (retry, cron duplicado etc.). Devolve `true` só quando
-- de fato inseriu (chamador usa isso pra saber se era mesmo a primeira vez).
create or replace function financeiro.fn_regua_registrar_envio(
  p_lancamento_id uuid,
  p_ponto_id uuid,
  p_status text,
  p_canal_efetivo text default null,
  p_motivo text default null
)
returns boolean
language plpgsql
security invoker
set search_path = financeiro, pg_temp
as $$
declare
  v_linhas int;
begin
  insert into financeiro.regua_envios (lancamento_id, ponto_id, canal_efetivo, status, motivo)
  values (p_lancamento_id, p_ponto_id, p_canal_efetivo, p_status, p_motivo)
  on conflict (lancamento_id, ponto_id) do nothing;
  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

revoke all on function financeiro.fn_regua_registrar_envio(uuid, uuid, text, text, text) from public;
grant execute on function financeiro.fn_regua_registrar_envio(uuid, uuid, text, text, text) to service_role;

-- AC-2: cron diário chamando a Edge Function de disparo — mesmo padrão de 0013_E01-S11 (`pg_net` +
-- secrets genéricos do Vault já existentes, no-op silencioso se ausentes). 12:00 UTC = 09:00 BRT
-- (horário comercial — mensagem pro cliente não deve sair de madrugada).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

create or replace function financeiro.fn_regua_cobranca_disparo_diario()
returns void
language plpgsql
security definer
set search_path = financeiro, extensions, vault, public
as $$
declare
  v_project_url text;
  v_service_role_key text;
  v_headers jsonb;
  v_request_id bigint;
begin
  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'auvo_trigger_project_url' limit 1;
  select decrypted_secret into v_service_role_key
    from vault.decrypted_secrets where name = 'auvo_trigger_service_role_key' limit 1;

  if v_project_url is null or v_service_role_key is null then
    raise warning 'fn_regua_cobranca_disparo_diario: secrets do Vault ausentes (auvo_trigger_project_url/auvo_trigger_service_role_key) — disparo diário pulado';
    return;
  end if;

  v_headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_role_key);

  select net.http_post(
    url := v_project_url || '/functions/v1/financeiro-regua-cobranca-disparo',
    headers := v_headers,
    body := '{}'::jsonb
  ) into v_request_id;
exception
  when others then
    raise warning 'fn_regua_cobranca_disparo_diario: falha ao disparar pg_net — %', SQLERRM;
end;
$$;

select cron.schedule(
  'financeiro_regua_cobranca_diaria',
  '0 12 * * *',
  'select financeiro.fn_regua_cobranca_disparo_diario();'
);

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select jobid, jobname, schedule, command from cron.job where jobname = 'financeiro_regua_cobranca_diaria';
-- select * from financeiro.fn_regua_pendentes();
-- select financeiro.fn_regua_cobranca_disparo_diario();  -- disparo manual de teste
