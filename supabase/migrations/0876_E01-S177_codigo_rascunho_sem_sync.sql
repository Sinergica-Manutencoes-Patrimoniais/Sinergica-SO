-- Conserva as verificações de ciclo, marcos, referências e unicidade do comando 0363.
create table pcm.sso_codigo_rascunho_sem_sync_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_codigo_rascunho_sem_sync_gate(id,habilitado) values(true,false);
alter table pcm.sso_codigo_rascunho_sem_sync_gate enable row level security;alter table pcm.sso_codigo_rascunho_sem_sync_gate force row level security;
revoke all on pcm.sso_codigo_rascunho_sem_sync_gate from public,anon,authenticated,service_role;
alter function pcm.sso_editar_codigo_rascunho(uuid,text,uuid,integer,text,text) rename to sso_editar_codigo_rascunho_base_0876;
revoke all on function pcm.sso_editar_codigo_rascunho_base_0876(uuid,text,uuid,integer,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_editar_codigo_rascunho(p_request_id uuid,p_tipo text,p_ativo_id uuid,p_expected_revision integer,p_codigo_anterior text,p_codigo_novo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_sync text;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_codigo_rascunho_sem_sync_gate where id),false) then raise exception 'edicao_codigo_sem_sync_desabilitada' using errcode='55000';end if;
 v_sync:=current_setting('app.auvo_sync_write',true);perform pg_catalog.set_config('app.auvo_sync_write','true',true);
 v_resultado:=pcm.sso_editar_codigo_rascunho_base_0876(p_request_id,p_tipo,p_ativo_id,p_expected_revision,p_codigo_anterior,p_codigo_novo);
 perform pg_catalog.set_config('app.auvo_sync_write',coalesce(v_sync,''),true);
 return v_resultado;
end;$$;
revoke all on function pcm.sso_editar_codigo_rascunho(uuid,text,uuid,integer,text,text) from public,anon,authenticated,service_role;
