-- ADR-0276: wrapper transacional; chamadas permanecem privadas.
create table pcm.sso_grupo_levantamento_motivos(
  request_id uuid primary key, ator_id uuid not null references auth.users(id), payload jsonb not null, resultado jsonb not null
);
alter table pcm.sso_grupo_levantamento_motivos enable row level security;
alter table pcm.sso_grupo_levantamento_motivos force row level security;
revoke all on pcm.sso_grupo_levantamento_motivos from public,anon,authenticated,service_role;

create function pcm.sso_atualizar_grupo_levantamento_motivado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_grupo_id uuid,p_grupo_revision integer,p_local_id uuid,p_caracteristicas jsonb,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_txid bigint:=pg_catalog.txid_current();v_motivo text:=btrim(p_motivo);
  v_lote pcm.sso_levantamentos%rowtype;v_antes pcm.grupos_quantitativos%rowtype;v_depois pcm.grupos_quantitativos%rowtype;v_cmd pcm.sso_grupo_levantamento_motivos%rowtype;v_payload jsonb;v_resultado jsonb;
begin
  if v_actor is null or p_request_id is null or p_grupo_id is null or v_motivo is null or length(v_motivo) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('loteId',p_lote_id,'expectedRevision',p_expected_revision,'chave',p_chave,'grupoId',p_grupo_id,'grupoRevision',p_grupo_revision,'localId',p_local_id,'caracteristicas',p_caracteristicas,'motivo',v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'lote_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_antes from pcm.grupos_quantitativos where id=p_grupo_id for update;
  if not found or v_antes.cliente_id is distinct from v_lote.cliente_id then raise exception 'grupo_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_cmd from pcm.sso_grupo_levantamento_motivos where request_id=p_request_id;
  if found then
    if v_cmd.ator_id is distinct from v_actor or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_cmd.resultado;
  end if;
  if exists(select 1 from pcm.sso_levantamento_comandos where request_id=p_request_id) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  if coalesce((select habilitado from pcm.sso_exigir_motivo_quantidade_gate where id),false) then
    insert into pcm.sso_quantidade_grupo_autorizacoes(txid,grupo_id,ator_id) values(v_txid,p_grupo_id,v_actor);
  end if;
  v_resultado:=pcm.sso_atualizar_grupo_levantamento(p_request_id,p_lote_id,p_expected_revision,p_chave,p_grupo_id,p_grupo_revision,p_local_id,p_caracteristicas);
  delete from pcm.sso_quantidade_grupo_autorizacoes where txid=v_txid and grupo_id=p_grupo_id and ator_id=v_actor;
  select * into v_depois from pcm.grupos_quantitativos where id=p_grupo_id;
  if v_antes.quantidade is distinct from v_depois.quantidade then
    insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'grupo.atualizado','grupos_quantitativos',p_grupo_id,jsonb_build_object('operacao','quantidade','requestId',p_request_id,'motivo',v_motivo,'origem','levantamento','antes',to_jsonb(v_antes),'depois',to_jsonb(v_depois)));
  end if;
  insert into pcm.sso_grupo_levantamento_motivos(request_id,ator_id,payload,resultado) values(p_request_id,v_actor,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_atualizar_grupo_levantamento_motivado(uuid,uuid,integer,text,uuid,integer,uuid,jsonb,text) from public,anon,authenticated,service_role;
