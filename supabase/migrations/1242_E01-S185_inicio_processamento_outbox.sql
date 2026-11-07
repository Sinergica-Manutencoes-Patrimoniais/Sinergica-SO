-- ADR-1093: marco observado no banco; não determina lease ou retry.
alter table pcm.auvo_sync_outbox add column processamento_iniciado_em timestamptz;

create function pcm.sso_marcar_inicio_processamento_outbox() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    new.processamento_iniciado_em:=case when new.status='processing' then pg_catalog.clock_timestamp() else null end;
  elsif new.status='processing' and old.status is distinct from 'processing' then
    new.processamento_iniciado_em:=pg_catalog.clock_timestamp();
  elsif new.status='processing' then
    new.processamento_iniciado_em:=old.processamento_iniciado_em;
  else
    new.processamento_iniciado_em:=null;
  end if;
  return new;
end; $$;
revoke all on function pcm.sso_marcar_inicio_processamento_outbox() from public,anon,authenticated,service_role;
create trigger sso_marcar_inicio_processamento_outbox before insert or update on pcm.auvo_sync_outbox
for each row execute function pcm.sso_marcar_inicio_processamento_outbox();
