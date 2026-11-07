-- ADR-0273: proteção opt-in, preserva comportamento legado enquanto desligada.
create table pcm.sso_exigir_motivo_quantidade_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_exigir_motivo_quantidade_gate(id,habilitado) values(true,false);
create table pcm.sso_quantidade_grupo_autorizacoes(txid bigint not null,grupo_id uuid not null,ator_id uuid not null,primary key(txid,grupo_id,ator_id));
alter table pcm.sso_exigir_motivo_quantidade_gate enable row level security;
alter table pcm.sso_exigir_motivo_quantidade_gate force row level security;
alter table pcm.sso_quantidade_grupo_autorizacoes enable row level security;
alter table pcm.sso_quantidade_grupo_autorizacoes force row level security;
revoke all on pcm.sso_exigir_motivo_quantidade_gate,pcm.sso_quantidade_grupo_autorizacoes from public,anon,authenticated,service_role;

create function pcm.sso_exigir_motivo_quantidade_grupo() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.quantidade is distinct from old.quantidade and coalesce((select habilitado from pcm.sso_exigir_motivo_quantidade_gate where id),false) then
    delete from pcm.sso_quantidade_grupo_autorizacoes where txid=pg_catalog.txid_current() and grupo_id=old.id and ator_id=auth.uid();
    if not found then raise exception 'quantidade_exige_comando_motivado' using errcode='23514'; end if;
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_exigir_motivo_quantidade_grupo() from public,anon,authenticated,service_role;
create trigger sso_grupo_exigir_motivo_quantidade before update of quantidade on pcm.grupos_quantitativos for each row execute function pcm.sso_exigir_motivo_quantidade_grupo();

alter function pcm.sso_alterar_quantidade_grupo(uuid,uuid,integer,bigint,text) rename to sso_alterar_quantidade_grupo_interno;
revoke all on function pcm.sso_alterar_quantidade_grupo_interno(uuid,uuid,integer,bigint,text) from public,anon,authenticated,service_role;
create function pcm.sso_alterar_quantidade_grupo(p_request_id uuid,p_grupo_id uuid,p_expected_revision integer,p_quantidade bigint,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_resultado jsonb;v_actor uuid:=auth.uid();v_txid bigint:=pg_catalog.txid_current();
begin
  if v_actor is null or p_grupo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if coalesce((select habilitado from pcm.sso_exigir_motivo_quantidade_gate where id),false) then
    insert into pcm.sso_quantidade_grupo_autorizacoes(txid,grupo_id,ator_id) values(v_txid,p_grupo_id,v_actor);
  end if;
  v_resultado:=pcm.sso_alterar_quantidade_grupo_interno(p_request_id,p_grupo_id,p_expected_revision,p_quantidade,p_motivo);
  delete from pcm.sso_quantidade_grupo_autorizacoes where txid=v_txid and grupo_id=p_grupo_id and ator_id=v_actor;
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_alterar_quantidade_grupo(uuid,uuid,integer,bigint,text) from public,anon,authenticated,service_role;
