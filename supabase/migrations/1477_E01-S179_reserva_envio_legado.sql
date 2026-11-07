-- ADR-1327: reserva para coordenação local; gate fechado, sem efeitos Auvo.
create table pcm.sso_reserva_envio_legado_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_reserva_envio_legado_gate(id,habilitado) values(true,false);
create table pcm.sso_reservas_envio_legado(
  id uuid primary key, os_id uuid not null references pcm.ordens_servico(id),
  cliente_id uuid not null references pcm.clientes(id), estado text not null check(estado in ('pendente','confirmado')),
  tarefa_id bigint, criado_em timestamptz not null default now(), confirmado_em timestamptz,
  check((estado='pendente' and tarefa_id is null and confirmado_em is null) or
        (estado='confirmado' and tarefa_id>0 and confirmado_em is not null))
);
create unique index sso_reserva_envio_legado_pendente on pcm.sso_reservas_envio_legado(os_id) where estado='pendente';
alter table pcm.sso_reserva_envio_legado_gate enable row level security;
alter table pcm.sso_reserva_envio_legado_gate force row level security;
alter table pcm.sso_reservas_envio_legado enable row level security;
alter table pcm.sso_reservas_envio_legado force row level security;
revoke all on pcm.sso_reserva_envio_legado_gate,pcm.sso_reservas_envio_legado from public,anon,authenticated,service_role;

create function pcm.sso_reservar_envio_legado_material(p_os_id uuid,p_reserva_id uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_cliente uuid; v_estado text;
begin
  if auth.role() is distinct from 'service_role' or p_os_id is null or p_reserva_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.sso_reserva_envio_legado_gate where id and habilitado for share;
  if not found then raise exception 'reserva_envio_desabilitada' using errcode='55000'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('impedimento-material-os:'||p_os_id::text,0)) then raise exception 'os_em_alteracao' using errcode='55P03'; end if;
  select o.client_id into v_cliente from pcm.ordens_servico o where o.id=p_os_id and o.deleted_at is null and o.auvo_task_id is null for update;
  if not found then raise exception 'os_indisponivel' using errcode='23514'; end if;
  select e.estado into v_estado from pcm.sso_impedimento_material_os_eventos e where e.os_id=p_os_id order by e.revisao desc limit 1;
  if v_estado='suspenso' then raise exception 'impedimento_material_ativo' using errcode='55000'; end if;
  if exists(select 1 from pcm.sso_reservas_envio_legado r where r.id=p_reserva_id) then
    if exists(select 1 from pcm.sso_reservas_envio_legado r where r.id=p_reserva_id and r.os_id=p_os_id and r.cliente_id=v_cliente and r.estado='pendente') then return; end if;
    raise exception 'reserva_conflitante' using errcode='23505';
  end if;
  insert into pcm.sso_reservas_envio_legado(id,os_id,cliente_id,estado) values(p_reserva_id,p_os_id,v_cliente,'pendente');
  insert into audit.events(action,entity,entity_id,payload) values('material.envio_legado_reservado','ordens_servico',p_os_id,jsonb_build_object('reservaId',p_reserva_id));
end; $$;
revoke all on function pcm.sso_reservar_envio_legado_material(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reservar_envio_legado_material(uuid,uuid) to service_role;

create function pcm.sso_confirmar_envio_legado_material(p_os_id uuid,p_reserva_id uuid,p_tarefa_id bigint)
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_reserva uuid;
begin
  if auth.role() is distinct from 'service_role' or p_os_id is null or p_reserva_id is null or p_tarefa_id is null or p_tarefa_id<1 then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.sso_reserva_envio_legado_gate where id and habilitado for share;
  if not found then raise exception 'reserva_envio_desabilitada' using errcode='55000'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('impedimento-material-os:'||p_os_id::text,0)) then raise exception 'os_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.ordens_servico o where o.id=p_os_id and o.deleted_at is null and o.auvo_task_id=p_tarefa_id for share;
  if not found then raise exception 'tarefa_nao_confirmada' using errcode='23514'; end if;
  update pcm.sso_reservas_envio_legado set estado='confirmado',tarefa_id=p_tarefa_id,confirmado_em=now()
    where id=p_reserva_id and os_id=p_os_id and estado='pendente' returning id into v_reserva;
  if not found then
    -- Repetição exata após resposta perdida; não aceita outra OS ou tarefa.
    if exists(select 1 from pcm.sso_reservas_envio_legado r where r.id=p_reserva_id and r.os_id=p_os_id
      and r.estado='confirmado' and r.tarefa_id=p_tarefa_id) then return; end if;
    raise exception 'reserva_nao_confirmada' using errcode='23514';
  end if;
  insert into audit.events(action,entity,entity_id,payload) values('material.envio_legado_confirmado','ordens_servico',p_os_id,jsonb_build_object('reservaId',v_reserva,'tarefaId',p_tarefa_id));
end; $$;
revoke all on function pcm.sso_confirmar_envio_legado_material(uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_confirmar_envio_legado_material(uuid,uuid,bigint) to service_role;

create function pcm.sso_guardar_suspensao_envio_legado()
returns trigger language plpgsql volatile security definer set search_path='' as $$
begin
  if new.estado<>'suspenso' then return new; end if;
  perform 1 from pcm.sso_reserva_envio_legado_gate where id and habilitado for share;
  if not found then return new; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('impedimento-material-os:'||new.os_id::text,0)) then raise exception 'os_em_alteracao' using errcode='55P03'; end if;
  if exists(select 1 from pcm.sso_reservas_envio_legado r where r.os_id=new.os_id and r.estado='pendente') then
    raise exception 'envio_legado_pendente_reconciliacao' using errcode='55000';
  end if;
  return new;
end; $$;
revoke all on function pcm.sso_guardar_suspensao_envio_legado() from public,anon,authenticated,service_role;
create trigger sso_guardar_suspensao_envio_legado before insert on pcm.sso_impedimento_material_os_eventos
for each row execute function pcm.sso_guardar_suspensao_envio_legado();
