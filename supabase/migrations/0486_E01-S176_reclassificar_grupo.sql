-- ADR-0260: preparação aditiva e fechada; não altera comando legado.
create table pcm.sso_reclassificar_grupo_gate (id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_reclassificar_grupo_gate(id,habilitado) values(true,false);
alter table pcm.sso_reclassificar_grupo_gate enable row level security;
alter table pcm.sso_reclassificar_grupo_gate force row level security;
revoke all on pcm.sso_reclassificar_grupo_gate from public,anon,authenticated,service_role;

create function pcm.sso_reclassificar_grupo(p_request_id uuid,p_grupo_id uuid,p_expected_revision integer,p_categoria_id uuid,p_sistema_id uuid,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_antes pcm.grupos_quantitativos%rowtype;v_depois pcm.grupos_quantitativos%rowtype;
  v_cmd pcm.estrutura_comandos%rowtype;v_payload jsonb;v_resultado jsonb;v_motivo text:=btrim(p_motivo);
begin
  if not coalesce((select habilitado from pcm.sso_reclassificar_grupo_gate where id),false) then raise exception 'reclassificacao_desabilitada' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_grupo_id is null or p_expected_revision is null or p_expected_revision<1 or p_categoria_id is null or v_motivo is null or length(v_motivo) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('tipo','reclassificarGrupo','grupoId',p_grupo_id,'expectedRevision',p_expected_revision,'categoriaId',p_categoria_id,'sistemaId',p_sistema_id,'motivo',v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into v_antes from pcm.grupos_quantitativos where id=p_grupo_id for update;
  if not found or not v_antes.ativo or v_antes.deleted_at is not null or config.sso_autorizar_acao('cadastro.gerir',v_antes.cliente_id) is not true then raise exception 'grupo_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_cmd from pcm.estrutura_comandos where request_id=p_request_id;
  if found then
    if v_cmd.actor_id is distinct from v_actor or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_cmd.resultado;
  end if;
  if v_antes.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  perform 1 from pcm.equipamento_categorias where id=p_categoria_id and deleted_at is null for share;
  if not found then raise exception 'categoria_indisponivel' using errcode='23514'; end if;
  if p_sistema_id is not null then
    perform 1 from pcm.sistemas where id=p_sistema_id and cliente_id=v_antes.cliente_id and ativo and deleted_at is null for share;
    if not found then raise exception 'sistema_invalido_ou_de_outro_cliente' using errcode='23514'; end if;
  end if;
  if v_antes.categoria_id is not distinct from p_categoria_id and v_antes.sistema_id is not distinct from p_sistema_id then raise exception 'sem_alteracao' using errcode='23514'; end if;
  update pcm.grupos_quantitativos set categoria_id=p_categoria_id,sistema_id=p_sistema_id,revisao=revisao+1,updated_at=now(),updated_by=v_actor where id=p_grupo_id returning * into v_depois;
  v_resultado:=jsonb_build_object('aggregateId',p_grupo_id,'revision',v_depois.revisao,'requestId',p_request_id,'categoriaId',p_categoria_id,'sistemaId',p_sistema_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'grupo.atualizado','grupos_quantitativos',p_grupo_id,jsonb_build_object('operacao','reclassificacao','requestId',p_request_id,'motivo',v_motivo,'antes',to_jsonb(v_antes),'depois',to_jsonb(v_depois)));
  insert into pcm.estrutura_comandos(request_id,actor_id,payload,resultado) values(p_request_id,v_actor,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_reclassificar_grupo(uuid,uuid,integer,uuid,uuid,text) from public,anon,authenticated,service_role;
