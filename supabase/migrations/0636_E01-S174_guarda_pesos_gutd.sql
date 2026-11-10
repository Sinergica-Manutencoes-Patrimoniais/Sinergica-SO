-- ADR-0410: proteção opt-in; não muda pesos nem comportamento quando desligada.
create table pcm.sso_exigir_auditoria_pesos_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_exigir_auditoria_pesos_gate(id,habilitado) values(true,false);
create table pcm.sso_autorizacoes_pesos(txid bigint not null,ator_id uuid not null,primary key(txid,ator_id));
alter table pcm.sso_exigir_auditoria_pesos_gate enable row level security;alter table pcm.sso_exigir_auditoria_pesos_gate force row level security;
alter table pcm.sso_autorizacoes_pesos enable row level security;alter table pcm.sso_autorizacoes_pesos force row level security;
revoke all on pcm.sso_exigir_auditoria_pesos_gate,pcm.sso_autorizacoes_pesos from public,anon,authenticated,service_role;
create function pcm.sso_guardar_pesos_gutd() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if coalesce((select habilitado from pcm.sso_exigir_auditoria_pesos_gate where id),false) then
    if tg_op<>'UPDATE' then raise exception 'pesos_exigem_comando_auditado' using errcode='23514'; end if;
    if (old.peso_gravidade,old.peso_urgencia,old.peso_tendencia,old.peso_dor_cliente) is distinct from (new.peso_gravidade,new.peso_urgencia,new.peso_tendencia,new.peso_dor_cliente) then
      delete from pcm.sso_autorizacoes_pesos where txid=pg_catalog.txid_current() and ator_id=auth.uid();
      if not found then raise exception 'pesos_exigem_comando_auditado' using errcode='23514'; end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;return new;
end;
$$;
revoke all on function pcm.sso_guardar_pesos_gutd() from public,anon,authenticated,service_role;
create trigger sso_guardar_pesos_gutd before insert or update or delete on config.priorizacao_gutd for each row execute function pcm.sso_guardar_pesos_gutd();
alter function pcm.sso_atualizar_pesos_gutd(uuid,jsonb,integer,integer,integer,integer,text) rename to sso_atualizar_pesos_gutd_interno;
revoke all on function pcm.sso_atualizar_pesos_gutd_interno(uuid,jsonb,integer,integer,integer,integer,text) from public,anon,authenticated,service_role;
create function pcm.sso_atualizar_pesos_gutd(p_request_id uuid,p_antes jsonb,p_g integer,p_u integer,p_t integer,p_d integer,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_txid bigint:=pg_catalog.txid_current();v_resultado jsonb;
begin
  if v_actor is null or auth.jwt()->>'user_role' is distinct from 'superadmin' then raise exception 'sem_acesso' using errcode='42501'; end if;
  if coalesce((select habilitado from pcm.sso_exigir_auditoria_pesos_gate where id),false) then insert into pcm.sso_autorizacoes_pesos(txid,ator_id) values(v_txid,v_actor); end if;
  v_resultado:=pcm.sso_atualizar_pesos_gutd_interno(p_request_id,p_antes,p_g,p_u,p_t,p_d,p_motivo);
  delete from pcm.sso_autorizacoes_pesos where txid=v_txid and ator_id=v_actor;
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_atualizar_pesos_gutd(uuid,jsonb,integer,integer,integer,integer,text) from public,anon,authenticated,service_role;
