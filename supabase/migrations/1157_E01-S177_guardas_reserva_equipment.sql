-- ADR-1004: nenhuma liberação implícita; gate inicialmente fechado.
create or replace function pcm.sso_guardar_reserva_equipment() returns trigger language plpgsql security definer set search_path='' as $$
declare v_ativo boolean; v_bloqueado boolean;
begin
  select g.habilitado into v_ativo from pcm.sso_reserva_equipment_gate g where g.id for share;
  if v_ativo is distinct from true then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-equipment-outbound',0)) then raise exception 'equipment_em_preparacao' using errcode='55P03'; end if;
  if tg_table_name='sso_politica_equipment_categoria' then
    select exists(select 1 from pcm.sso_reserva_equipment_outbox r where r.categoria_id=old.categoria_id) into v_bloqueado;
  elsif tg_table_name='sso_categoria_componente' then
    select exists(select 1 from pcm.sso_reserva_equipment_outbox r where r.componente_id=old.componente_id) into v_bloqueado;
  elsif tg_table_name='equipamento_categorias' then
    select exists(select 1 from pcm.sso_reserva_equipment_outbox r where r.categoria_id=old.id) into v_bloqueado;
  else
    select exists(select 1 from pcm.sso_reserva_equipment_outbox r where r.componente_id=old.id) into v_bloqueado;
  end if;
  if v_bloqueado then raise exception 'equipment_com_envio_pendente' using errcode='55P03'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function pcm.sso_guardar_reserva_equipment() from public,anon,authenticated,service_role;

create trigger sso_reserva_guarda_ids_auvo before update of auvo_id,auvo_equipment_id on pcm.equipamentos
  for each row when (old.auvo_id is distinct from new.auvo_id or old.auvo_equipment_id is distinct from new.auvo_equipment_id)
  execute function pcm.sso_guardar_reserva_equipment();
create trigger sso_reserva_guarda_exclusao_categoria before delete on pcm.equipamento_categorias
  for each row execute function pcm.sso_guardar_reserva_equipment();
create trigger sso_reserva_guarda_desativacao_categoria before update of deleted_at on pcm.equipamento_categorias
  for each row when (old.deleted_at is distinct from new.deleted_at)
  execute function pcm.sso_guardar_reserva_equipment();
