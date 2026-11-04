-- ADR-1005: confirma create/update; nenhuma concessão operacional.
create table pcm.sso_equipment_confirmacoes (
  outbox_id uuid primary key references pcm.auvo_sync_outbox(id), componente_id uuid not null references pcm.equipamentos(id),
  auvo_id bigint not null check(auvo_id>0), operacao text not null check(operacao in ('create','update')),
  confirmado_em timestamptz not null default now()
);
alter table pcm.sso_equipment_confirmacoes enable row level security;
alter table pcm.sso_equipment_confirmacoes force row level security;
revoke all on pcm.sso_equipment_confirmacoes from public,anon,authenticated,service_role;
create function pcm.sso_guardar_confirmacao_equipment() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'confirmacao_equipment_imutavel' using errcode='23514'; end;
$$;
revoke all on function pcm.sso_guardar_confirmacao_equipment() from public,anon,authenticated,service_role;
create trigger sso_equipment_confirmacao_imutavel before update or delete on pcm.sso_equipment_confirmacoes for each row execute function pcm.sso_guardar_confirmacao_equipment();

create function pcm.sso_confirmar_equipment_outbox(p_outbox_id uuid,p_componente_id uuid,p_auvo_id bigint,p_operacao text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_reserva pcm.sso_reserva_equipment_outbox%rowtype; v_recibo pcm.sso_equipment_confirmacoes%rowtype; v_outbox pcm.auvo_sync_outbox%rowtype; v_e pcm.equipamentos%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_outbox_id is null or p_componente_id is null or p_auvo_id is null or p_auvo_id<=0 or p_operacao is null or p_operacao not in ('create','update') then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-equipment-outbound',0)) then raise exception 'equipment_em_preparacao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_reserva_equipment_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'reserva_equipment_desabilitada' using errcode='55000'; end if;
  select * into v_recibo from pcm.sso_equipment_confirmacoes where outbox_id=p_outbox_id;
  if found then
    if v_recibo.componente_id is distinct from p_componente_id or v_recibo.auvo_id is distinct from p_auvo_id or v_recibo.operacao is distinct from p_operacao then raise exception 'confirmacao_divergente' using errcode='23505'; end if;
    return pg_catalog.jsonb_build_object('outboxId',p_outbox_id,'componenteId',p_componente_id,'auvoId',p_auvo_id,'operacao',p_operacao,'confirmadoEm',v_recibo.confirmado_em);
  end if;
  select * into v_reserva from pcm.sso_reserva_equipment_outbox where componente_id=p_componente_id and outbox_id=p_outbox_id for update;
  if not found then raise exception 'reserva_indisponivel' using errcode='23514'; end if;
  select * into v_outbox from pcm.auvo_sync_outbox where id=p_outbox_id for update;
  if not found or v_outbox.entity<>'equipamentos' or v_outbox.row_id is distinct from p_componente_id or v_outbox.op is distinct from p_operacao or v_outbox.status<>'processing' then raise exception 'outbox_divergente' using errcode='23514'; end if;
  select * into v_e from pcm.equipamentos where id=p_componente_id for update;
  if not found or (v_e.auvo_id is not null and v_e.auvo_id<>p_auvo_id) or (v_e.auvo_equipment_id is not null and v_e.auvo_equipment_id<>p_auvo_id) then raise exception 'vinculo_auvo_divergente' using errcode='23514'; end if;
  if p_operacao='update' and v_e.auvo_id is null and v_e.auvo_equipment_id is null then raise exception 'vinculo_auvo_ausente' using errcode='23514'; end if;
  delete from pcm.sso_reserva_equipment_outbox where componente_id=p_componente_id and outbox_id=p_outbox_id;
  perform pcm.fn_apply_auvo_sync('equipamentos',p_componente_id,pg_catalog.jsonb_build_object('auvo_id',p_auvo_id,'auvo_sync_status','synced','auvo_synced_at',pg_catalog.now(),'auvo_sync_error',null));
  update pcm.auvo_sync_outbox set status='sent',sent_at=pg_catalog.now(),last_error=null where id=p_outbox_id;
  insert into pcm.sso_equipment_confirmacoes(outbox_id,componente_id,auvo_id,operacao) values(p_outbox_id,p_componente_id,p_auvo_id,p_operacao) returning * into v_recibo;
  return pg_catalog.jsonb_build_object('outboxId',p_outbox_id,'componenteId',p_componente_id,'auvoId',p_auvo_id,'operacao',p_operacao,'confirmadoEm',v_recibo.confirmado_em);
end;
$$;
revoke all on function pcm.sso_confirmar_equipment_outbox(uuid,uuid,bigint,text) from public,anon,authenticated,service_role;
