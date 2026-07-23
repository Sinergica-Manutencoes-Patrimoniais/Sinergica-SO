-- 0146_E02-S22_atendimento_evolution_multiinstancia.sql — Sinérgica SO
-- Runtime operacional para múltiplas instâncias no mesmo servidor Evolution: handoff auditável,
-- vínculo conversa→Cliente PCM atômico, rate limit do webhook e integridade do vínculo de agente.
--
-- Reverso:
--   drop trigger if exists trg_validar_instancia_agente_evolution on atendimento.instancias_agente;
--   drop function if exists atendimento.fn_validar_instancia_agente_evolution();
--   drop function if exists atendimento.fn_consumir_rate_limit_webhook(text,int,int);
--   drop function if exists atendimento.fn_vincular_conversa_cliente(uuid,uuid);
--   drop function if exists atendimento.fn_listar_clientes_para_vinculo();
--   drop function if exists atendimento.fn_definir_handoff(uuid,text,text);
--   drop table if exists atendimento.webhook_rate_limits;
--   drop table if exists atendimento.conversa_cliente_eventos;
--   drop table if exists atendimento.handoff_eventos;
--   alter table atendimento.personas drop column if exists prompt_versao;
--   alter table atendimento.conversas drop column if exists handoff_motivo;
--   alter table atendimento.conversas drop column if exists handoff_em;

alter table atendimento.conversas
  add column if not exists handoff_motivo text,
  add column if not exists handoff_em timestamptz;

alter table atendimento.personas
  add column if not exists prompt_versao text not null default 'custom-v1';

update atendimento.personas
set prompt_versao = 'e02-s22-chamados-v1'
where tipo = 'chamados'
  and prompt_versao = 'custom-v1'
  and prompt_sistema like 'Você é o Agente Zé da Sinérgica.%';

create table if not exists atendimento.handoff_eventos (
  id          uuid        primary key default gen_random_uuid(),
  conversa_id uuid        not null references atendimento.conversas(id),
  acao        text        not null check (acao in ('automatico', 'assumir', 'devolver', 'envio_humano')),
  motivo      text,
  actor_id    uuid        references auth.users,
  created_at  timestamptz not null default now()
);

create index if not exists idx_handoff_eventos_conversa_created
  on atendimento.handoff_eventos (conversa_id, created_at desc);

create table if not exists atendimento.conversa_cliente_eventos (
  id                uuid        primary key default gen_random_uuid(),
  conversa_id       uuid        not null references atendimento.conversas(id),
  contato_id        uuid        references relacionamento.contatos(id),
  cliente_anterior  uuid        references pcm.clientes(id),
  cliente_novo      uuid        not null references pcm.clientes(id),
  actor_id          uuid        not null references auth.users,
  created_at        timestamptz not null default now()
);

create index if not exists idx_conversa_cliente_eventos_conversa_created
  on atendimento.conversa_cliente_eventos (conversa_id, created_at desc);

-- Estado técnico de janela deslizante. Só service_role acessa; nenhum payload/PII é armazenado.
create table if not exists atendimento.webhook_rate_limits (
  chave         text        primary key,
  janela_inicio timestamptz not null,
  contagem      int         not null check (contagem >= 0),
  updated_at    timestamptz not null default now()
);

alter table atendimento.handoff_eventos          enable row level security;
alter table atendimento.handoff_eventos          force row level security;
alter table atendimento.conversa_cliente_eventos enable row level security;
alter table atendimento.conversa_cliente_eventos force row level security;
alter table atendimento.webhook_rate_limits      enable row level security;
alter table atendimento.webhook_rate_limits      force row level security;

grant select on atendimento.handoff_eventos, atendimento.conversa_cliente_eventos to authenticated;
grant select, insert on atendimento.handoff_eventos, atendimento.conversa_cliente_eventos to service_role;
grant select, insert, update, delete on atendimento.webhook_rate_limits to service_role;

create policy "handoff_eventos_select" on atendimento.handoff_eventos
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

create policy "conversa_cliente_eventos_select" on atendimento.conversa_cliente_eventos
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

create policy "webhook_rate_limits_service" on atendimento.webhook_rate_limits
  for all to service_role using (true) with check (true);

create or replace function atendimento.fn_definir_handoff(
  p_conversa_id uuid,
  p_acao text,
  p_motivo text default null
) returns void
language plpgsql
security definer
set search_path = atendimento, public
as $$
declare
  v_actor uuid := auth.uid();
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_pode_escrever boolean := (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );
  v_modo text;
  v_atribuido uuid;
begin
  if p_acao not in ('automatico', 'assumir', 'devolver', 'envio_humano') then
    raise exception 'ação de handoff inválida: %', p_acao using errcode = '22023';
  end if;
  if p_acao = 'automatico' and not v_service then
    raise exception 'handoff automático exige service_role' using errcode = '42501';
  end if;
  if p_acao <> 'automatico' and not v_pode_escrever then
    raise exception 'atendimento:escrita obrigatório' using errcode = '42501';
  end if;

  select modo, atribuido_a into v_modo, v_atribuido
  from atendimento.conversas
  where id = p_conversa_id
  for update;
  if not found then
    raise exception 'conversa não encontrada' using errcode = 'P0002';
  end if;

  if p_acao = 'devolver' then
    update atendimento.conversas
    set modo = 'auto', status = 'aberta', atribuido_a = null,
        handoff_motivo = null, handoff_em = null,
        updated_at = now(), updated_by = v_actor
    where id = p_conversa_id;
  elsif p_acao = 'automatico' then
    update atendimento.conversas
    set modo = 'pausado', status = 'pendente', atribuido_a = null,
        handoff_motivo = nullif(left(trim(coalesce(p_motivo, 'regra automática')), 500), ''),
        handoff_em = coalesce(handoff_em, now()), updated_at = now()
    where id = p_conversa_id;
  else
    update atendimento.conversas
    set modo = 'pausado', status = 'aberta', atribuido_a = v_actor,
        handoff_motivo = coalesce(nullif(left(trim(coalesce(p_motivo, '')), 500), ''), handoff_motivo),
        handoff_em = coalesce(handoff_em, now()), updated_at = now(), updated_by = v_actor
    where id = p_conversa_id;
  end if;

  -- Não duplica eventos de handoff automático para a mesma conversa já pausada pelo mesmo motivo.
  if p_acao <> 'automatico'
     or v_modo <> 'pausado'
     or not exists (
       select 1 from atendimento.handoff_eventos
       where conversa_id = p_conversa_id and acao = 'automatico'
         and motivo is not distinct from nullif(left(trim(coalesce(p_motivo, 'regra automática')), 500), '')
         and created_at >= now() - interval '1 minute'
     ) then
    insert into atendimento.handoff_eventos (conversa_id, acao, motivo, actor_id)
    values (p_conversa_id, p_acao, nullif(left(trim(coalesce(p_motivo, '')), 500), ''), v_actor);
  end if;
end;
$$;

revoke all on function atendimento.fn_definir_handoff(uuid, text, text) from public;
grant execute on function atendimento.fn_definir_handoff(uuid, text, text) to authenticated, service_role;

create or replace function atendimento.fn_vincular_conversa_cliente(
  p_conversa_id uuid,
  p_cliente_id uuid
) returns void
language plpgsql
security definer
set search_path = atendimento, relacionamento, pcm, public
as $$
declare
  v_actor uuid := auth.uid();
  v_pode_escrever boolean := (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );
  v_contato_id uuid;
  v_cliente_anterior uuid;
  v_remote_jid text;
begin
  if v_actor is null or not v_pode_escrever then
    raise exception 'atendimento:escrita obrigatório' using errcode = '42501';
  end if;
  if not exists (
    select 1 from pcm.clientes where id = p_cliente_id and ativo = true and deleted_at is null
  ) then
    raise exception 'cliente PCM ativo não encontrado' using errcode = 'P0002';
  end if;

  select contato_id, client_id, remote_jid
  into v_contato_id, v_cliente_anterior, v_remote_jid
  from atendimento.conversas
  where id = p_conversa_id
  for update;
  if not found then
    raise exception 'conversa não encontrada' using errcode = 'P0002';
  end if;

  if v_contato_id is null then
    v_contato_id := relacionamento.fn_upsert_contato_whatsapp(v_remote_jid, null);
  end if;

  update atendimento.conversas
  set client_id = p_cliente_id, contato_id = v_contato_id,
      updated_at = now(), updated_by = v_actor
  where id = p_conversa_id;

  update relacionamento.vinculos
  set principal = false, updated_at = now(), updated_by = v_actor
  where contato_id = v_contato_id
    and entidade_tipo = 'pcm_cliente'
    and entidade_id <> p_cliente_id
    and principal = true;

  insert into relacionamento.vinculos (
    contato_id, entidade_tipo, entidade_id, papel, principal, created_by, updated_by
  ) values (
    v_contato_id, 'pcm_cliente', p_cliente_id, 'contato', true, v_actor, v_actor
  )
  on conflict (contato_id, entidade_tipo, entidade_id) do update
  set principal = true, updated_at = now(), updated_by = excluded.updated_by;

  if v_cliente_anterior is distinct from p_cliente_id then
    insert into atendimento.conversa_cliente_eventos (
      conversa_id, contato_id, cliente_anterior, cliente_novo, actor_id
    ) values (
      p_conversa_id, v_contato_id, v_cliente_anterior, p_cliente_id, v_actor
    );
  end if;
end;
$$;

revoke all on function atendimento.fn_vincular_conversa_cliente(uuid, uuid) from public;
grant execute on function atendimento.fn_vincular_conversa_cliente(uuid, uuid) to authenticated;

create or replace function atendimento.fn_listar_clientes_para_vinculo()
returns table (id uuid, nome text)
language plpgsql
stable
security definer
set search_path = atendimento, pcm, public
as $$
begin
  if auth.uid() is null or not (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  ) then
    raise exception 'atendimento:escrita obrigatório' using errcode = '42501';
  end if;

  return query
  select c.id, c.nome
  from pcm.clientes c
  where c.ativo = true and c.deleted_at is null
  order by c.nome;
end;
$$;

revoke all on function atendimento.fn_listar_clientes_para_vinculo() from public;
grant execute on function atendimento.fn_listar_clientes_para_vinculo() to authenticated;

create or replace function atendimento.fn_consumir_rate_limit_webhook(
  p_chave text,
  p_limite int default 120,
  p_janela_segundos int default 60
) returns boolean
language plpgsql
security definer
set search_path = atendimento, public
as $$
declare
  v_agora timestamptz := clock_timestamp();
  v_linha atendimento.webhook_rate_limits%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role obrigatório' using errcode = '42501';
  end if;
  if nullif(trim(p_chave), '') is null or p_limite < 1 or p_janela_segundos < 1 then
    raise exception 'rate limit inválido' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_chave));
  select * into v_linha
  from atendimento.webhook_rate_limits
  where chave = p_chave
  for update;

  if not found or v_linha.janela_inicio <= v_agora - make_interval(secs => p_janela_segundos) then
    insert into atendimento.webhook_rate_limits (chave, janela_inicio, contagem, updated_at)
    values (p_chave, v_agora, 1, v_agora)
    on conflict (chave) do update
    set janela_inicio = excluded.janela_inicio, contagem = 1, updated_at = excluded.updated_at;
    return true;
  end if;

  if v_linha.contagem >= p_limite then
    return false;
  end if;

  update atendimento.webhook_rate_limits
  set contagem = contagem + 1, updated_at = v_agora
  where chave = p_chave;
  return true;
end;
$$;

revoke all on function atendimento.fn_consumir_rate_limit_webhook(text, int, int) from public;
grant execute on function atendimento.fn_consumir_rate_limit_webhook(text, int, int) to service_role;

create or replace function atendimento.fn_validar_instancia_agente_evolution()
returns trigger
language plpgsql
set search_path = atendimento, public
as $$
begin
  if not exists (
    select 1
    from atendimento.canais_externos
    where tipo = 'evolution'
      and ativo = true
      and identificador_externo = new.instance_id
  ) then
    raise exception 'instância Evolution ativa não encontrada: %', new.instance_id
      using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_instancia_agente_evolution on atendimento.instancias_agente;
create trigger trg_validar_instancia_agente_evolution
  before insert or update of instance_id, ativo on atendimento.instancias_agente
  for each row when (new.ativo = true)
  execute function atendimento.fn_validar_instancia_agente_evolution();
