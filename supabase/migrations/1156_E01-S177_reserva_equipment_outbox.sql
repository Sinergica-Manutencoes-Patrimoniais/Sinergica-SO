-- ADR-1003: reserva conservadora, sem concessões e sem expiração automática.
create table pcm.sso_reserva_equipment_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_reserva_equipment_gate(id,habilitado) values(true,false);
create table pcm.sso_reserva_equipment_outbox (
  componente_id uuid primary key references pcm.equipamentos(id), outbox_id uuid not null unique references pcm.auvo_sync_outbox(id),
  categoria_id uuid not null references pcm.equipamento_categorias(id), mapeamento_revisao integer not null, politica_revisao integer not null,
  criado_em timestamptz not null default now()
);
alter table pcm.sso_reserva_equipment_gate enable row level security;
alter table pcm.sso_reserva_equipment_gate force row level security;
alter table pcm.sso_reserva_equipment_outbox enable row level security;
alter table pcm.sso_reserva_equipment_outbox force row level security;
revoke all on pcm.sso_reserva_equipment_gate,pcm.sso_reserva_equipment_outbox from public,anon,authenticated,service_role;

create function pcm.sso_guardar_reserva_equipment() returns trigger language plpgsql security definer set search_path='' as $$
declare v_bloqueado boolean;
begin
  if not coalesce((select g.habilitado from pcm.sso_reserva_equipment_gate g where g.id),false) then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-equipment-outbound',0)) then raise exception 'equipment_em_preparacao' using errcode='55P03'; end if;
  if tg_table_name='sso_politica_equipment_categoria' then
    select exists(select 1 from pcm.sso_reserva_equipment_outbox r where r.categoria_id=old.categoria_id) into v_bloqueado;
  elsif tg_table_name='sso_categoria_componente' then
    select exists(select 1 from pcm.sso_reserva_equipment_outbox r where r.componente_id=old.componente_id) into v_bloqueado;
  else
    select exists(select 1 from pcm.sso_reserva_equipment_outbox r where r.componente_id=old.id) into v_bloqueado;
  end if;
  if v_bloqueado then raise exception 'equipment_com_envio_pendente' using errcode='55P03'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function pcm.sso_guardar_reserva_equipment() from public,anon,authenticated,service_role;
create trigger sso_reserva_guarda_politica before update or delete on pcm.sso_politica_equipment_categoria for each row execute function pcm.sso_guardar_reserva_equipment();
create trigger sso_reserva_guarda_mapeamento before update or delete on pcm.sso_categoria_componente for each row execute function pcm.sso_guardar_reserva_equipment();
create trigger sso_reserva_guarda_componente before update of categoria,client_id or delete on pcm.equipamentos for each row execute function pcm.sso_guardar_reserva_equipment();

create function pcm.sso_reservar_equipment_outbox(p_outbox_id uuid,p_componente_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_decisao jsonb; v_m pcm.sso_categoria_componente%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_outbox_id is null or p_componente_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-equipment-outbound',0)) then raise exception 'equipment_em_preparacao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_reserva_equipment_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'reserva_equipment_desabilitada' using errcode='55000'; end if;
  if not exists(select 1 from pcm.auvo_sync_outbox o where o.id=p_outbox_id and o.entity='equipamentos' and o.row_id=p_componente_id and o.status='processing') then raise exception 'outbox_indisponivel' using errcode='23514'; end if;
  if exists(select 1 from pcm.sso_reserva_equipment_outbox r where r.componente_id=p_componente_id or r.outbox_id=p_outbox_id) then raise exception 'equipment_com_envio_pendente' using errcode='55P03'; end if;
  v_decisao:=pcm.sso_decidir_equipment_outbox(p_componente_id);
  if v_decisao->>'representacao' is distinct from 'equipment' then raise exception 'equipment_nao_autorizado' using errcode='23514'; end if;
  select * into v_m from pcm.sso_categoria_componente where componente_id=p_componente_id;
  insert into pcm.sso_reserva_equipment_outbox(componente_id,outbox_id,categoria_id,mapeamento_revisao,politica_revisao)
    values(p_componente_id,p_outbox_id,v_m.categoria_id,(v_decisao->>'mapeamentoRevision')::integer,(v_decisao->>'politicaRevision')::integer);
  return pg_catalog.jsonb_build_object('outboxId',p_outbox_id,'componenteId',p_componente_id,'categoriaId',v_m.categoria_id,'mapeamentoRevision',(v_decisao->>'mapeamentoRevision')::integer,'politicaRevision',(v_decisao->>'politicaRevision')::integer);
end;
$$;
revoke all on function pcm.sso_reservar_equipment_outbox(uuid,uuid) from public,anon,authenticated,service_role;
