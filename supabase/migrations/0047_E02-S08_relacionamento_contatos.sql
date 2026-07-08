-- 0047_E02-S08_relacionamento_contatos.sql — Sinérgica SO
-- Base única de contatos/identidades de relacionamento. Não substitui `pcm.clientes` (entidade
-- operacional) nem `comercial.leads` (oportunidade); serve como eixo comum para histórico.
--
-- Reverso:
--   alter table comercial.leads drop constraint if exists leads_contato_id_fkey;
--   alter table atendimento.conversas drop constraint if exists conversas_lead_id_fkey;
--   alter table atendimento.conversas drop constraint if exists conversas_contato_id_fkey;
--   alter table comercial.leads drop column if exists contato_id;
--   alter table atendimento.conversas drop column if exists lead_id;
--   alter table atendimento.conversas drop column if exists contato_id;
--   drop function if exists relacionamento.get_timeline_contato(uuid, int);
--   drop function if exists relacionamento.fn_upsert_contato_whatsapp(text, text);
--   drop table if exists relacionamento.vinculos;
--   drop table if exists relacionamento.identidades_contato;
--   drop table if exists relacionamento.contatos;
--   drop schema if exists relacionamento;

create schema if not exists relacionamento;

create table if not exists relacionamento.contatos (
  id                uuid        primary key default gen_random_uuid(),
  nome              text,
  telefone_principal text,
  email_principal   text,
  origem            text        not null default 'manual',
  metadata          jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  created_by        uuid        references auth.users,
  updated_at        timestamptz,
  updated_by        uuid        references auth.users,
  deleted_at        timestamptz
);

create table if not exists relacionamento.identidades_contato (
  id                uuid        primary key default gen_random_uuid(),
  contato_id        uuid        not null references relacionamento.contatos(id),
  tipo              text        not null check (tipo in ('telefone', 'whatsapp', 'email', 'instagram', 'messenger')),
  valor             text        not null,
  valor_normalizado text        not null,
  canal_ref         text,
  created_at        timestamptz not null default now(),
  created_by        uuid        references auth.users,
  updated_at        timestamptz,
  updated_by        uuid        references auth.users,
  unique (tipo, valor_normalizado)
);

create table if not exists relacionamento.vinculos (
  id            uuid        primary key default gen_random_uuid(),
  contato_id    uuid        not null references relacionamento.contatos(id),
  entidade_tipo text        not null check (entidade_tipo in ('pcm_cliente', 'comercial_lead')),
  entidade_id   uuid        not null,
  papel         text,
  principal     boolean     not null default false,
  created_at    timestamptz not null default now(),
  created_by    uuid        references auth.users,
  updated_at    timestamptz,
  updated_by    uuid        references auth.users,
  unique (contato_id, entidade_tipo, entidade_id)
);

create index if not exists idx_relacionamento_contatos_nome
  on relacionamento.contatos (lower(nome));
create index if not exists idx_relacionamento_identidades_contato
  on relacionamento.identidades_contato (contato_id);
create index if not exists idx_relacionamento_vinculos_entidade
  on relacionamento.vinculos (entidade_tipo, entidade_id);

alter table relacionamento.contatos enable row level security;
alter table relacionamento.contatos force row level security;
alter table relacionamento.identidades_contato enable row level security;
alter table relacionamento.identidades_contato force row level security;
alter table relacionamento.vinculos enable row level security;
alter table relacionamento.vinculos force row level security;

grant usage on schema relacionamento to authenticated, service_role;
grant select, insert, update on
  relacionamento.contatos,
  relacionamento.identidades_contato,
  relacionamento.vinculos
to authenticated;
grant select, insert, update, delete on
  relacionamento.contatos,
  relacionamento.identidades_contato,
  relacionamento.vinculos
to service_role;

create policy "relacionamento_contatos_select" on relacionamento.contatos
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
    or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "relacionamento_contatos_insert" on relacionamento.contatos
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "relacionamento_contatos_update" on relacionamento.contatos
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "relacionamento_identidades_select" on relacionamento.identidades_contato
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
    or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "relacionamento_identidades_insert" on relacionamento.identidades_contato
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "relacionamento_identidades_update" on relacionamento.identidades_contato
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "relacionamento_vinculos_select" on relacionamento.vinculos
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
    or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "relacionamento_vinculos_insert" on relacionamento.vinculos
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "relacionamento_vinculos_update" on relacionamento.vinculos
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

alter table atendimento.conversas add column if not exists contato_id uuid;
alter table atendimento.conversas add column if not exists lead_id uuid;
alter table comercial.leads add column if not exists contato_id uuid;

alter table atendimento.conversas add constraint conversas_contato_id_fkey
  foreign key (contato_id) references relacionamento.contatos(id) not valid;
alter table atendimento.conversas add constraint conversas_lead_id_fkey
  foreign key (lead_id) references comercial.leads(id) not valid;
alter table comercial.leads add constraint leads_contato_id_fkey
  foreign key (contato_id) references relacionamento.contatos(id) not valid;

create or replace function relacionamento.fn_upsert_contato_whatsapp(
  p_remote_jid text,
  p_nome text default null
) returns uuid
language plpgsql
security definer
set search_path = relacionamento, public
as $$
declare
  v_norm text;
  v_contato_id uuid;
begin
  v_norm := lower(trim(coalesce(p_remote_jid, '')));
  if v_norm = '' then
    return null;
  end if;

  select contato_id into v_contato_id
    from relacionamento.identidades_contato
    where tipo = 'whatsapp' and valor_normalizado = v_norm
    limit 1;

  if v_contato_id is null then
    insert into relacionamento.contatos (nome, telefone_principal, origem)
    values (nullif(trim(coalesce(p_nome, '')), ''), regexp_replace(v_norm, '\D', '', 'g'), 'whatsapp')
    returning id into v_contato_id;

    insert into relacionamento.identidades_contato (contato_id, tipo, valor, valor_normalizado, canal_ref)
    values (v_contato_id, 'whatsapp', p_remote_jid, v_norm, p_remote_jid);
  else
    update relacionamento.contatos
    set nome = coalesce(nullif(nome, ''), nullif(trim(coalesce(p_nome, '')), '')),
        updated_at = now()
    where id = v_contato_id
      and nullif(trim(coalesce(p_nome, '')), '') is not null
      and (nome is null or trim(nome) = '');
  end if;

  return v_contato_id;
end;
$$;

revoke all on function relacionamento.fn_upsert_contato_whatsapp(text, text) from public;
grant execute on function relacionamento.fn_upsert_contato_whatsapp(text, text) to service_role;

create or replace function atendimento.fn_registrar_mensagem_entrada(
  p_instance_id text,
  p_remote_jid text,
  p_contato_nome text,
  p_conteudo text,
  p_wa_message_id text
) returns uuid
language plpgsql
security definer
set search_path = atendimento, relacionamento, public
as $$
declare
  v_conversa_id uuid;
  v_client_id uuid;
  v_contato_id uuid;
  v_inserted_message_id uuid;
begin
  select client_id into v_client_id
    from atendimento.config_ze
    where group_jid = p_remote_jid
    limit 1;

  v_contato_id := relacionamento.fn_upsert_contato_whatsapp(p_remote_jid, p_contato_nome);

  insert into atendimento.conversas (instance_id, remote_jid, client_id, contato_id, contato_nome)
  values (p_instance_id, p_remote_jid, v_client_id, v_contato_id, p_contato_nome)
  on conflict (instance_id, remote_jid) do update
  set contato_nome = coalesce(atendimento.conversas.contato_nome, excluded.contato_nome),
      contato_id = coalesce(atendimento.conversas.contato_id, excluded.contato_id)
  returning id into v_conversa_id;

  insert into atendimento.mensagens (conversa_id, direcao, remetente_tipo, conteudo, wa_message_id)
  values (v_conversa_id, 'entrada', 'cliente', p_conteudo, p_wa_message_id)
  on conflict (wa_message_id) do nothing
  returning id into v_inserted_message_id;

  if v_inserted_message_id is not null then
    update atendimento.conversas
    set nao_lidas = nao_lidas + 1,
        ultima_mensagem_preview = left(p_conteudo, 200),
        ultima_mensagem_em = now(),
        updated_at = now()
    where id = v_conversa_id;
  end if;

  return v_conversa_id;
end;
$$;

revoke all on function atendimento.fn_registrar_mensagem_entrada(text, text, text, text, text) from public;
grant execute on function atendimento.fn_registrar_mensagem_entrada(text, text, text, text, text) to service_role;

create or replace function relacionamento.get_timeline_contato(
  p_contato_id uuid,
  p_limit int default 50
) returns table (
  evento_tipo text,
  entidade_tipo text,
  entidade_id uuid,
  titulo text,
  descricao text,
  ocorreu_em timestamptz,
  payload jsonb
)
language sql
stable
security definer
set search_path = relacionamento, atendimento, comercial, public
as $$
  with allowed as (
    select
      current_user = 'service_role'
      or auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
      or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
      or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita') as ok
  )
  select *
  from (
    select
      'conversa'::text as evento_tipo,
      'atendimento.conversas'::text as entidade_tipo,
      c.id as entidade_id,
      coalesce(c.contato_nome, 'Conversa')::text as titulo,
      c.ultima_mensagem_preview::text as descricao,
      coalesce(c.ultima_mensagem_em, c.created_at) as ocorreu_em,
      jsonb_build_object('canal', c.canal, 'status', c.status, 'client_id', c.client_id, 'lead_id', c.lead_id) as payload
    from atendimento.conversas c
    where c.contato_id = p_contato_id

    union all

    select
      'mensagem'::text,
      'atendimento.mensagens'::text,
      m.id,
      case m.direcao when 'entrada' then 'Mensagem recebida' else 'Mensagem enviada' end,
      left(coalesce(m.conteudo, ''), 240),
      m.created_at,
      jsonb_build_object('direcao', m.direcao, 'remetente_tipo', m.remetente_tipo, 'status_entrega', m.status_entrega)
    from atendimento.mensagens m
    join atendimento.conversas c on c.id = m.conversa_id
    where c.contato_id = p_contato_id

    union all

    select
      'lead'::text,
      'comercial.leads'::text,
      l.id,
      coalesce(l.nome, 'Lead')::text,
      coalesce(l.resumo, l.origem, l.status)::text,
      l.created_at,
      jsonb_build_object('status', l.status, 'score', l.score, 'origem', l.origem, 'conversa_id', l.conversa_id)
    from comercial.leads l
    where l.contato_id = p_contato_id
  ) eventos
  where exists (select 1 from allowed where ok)
  order by ocorreu_em desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function relacionamento.get_timeline_contato(uuid, int) from public;
grant execute on function relacionamento.get_timeline_contato(uuid, int) to authenticated, service_role;
