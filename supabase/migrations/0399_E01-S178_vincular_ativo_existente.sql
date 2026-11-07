-- ADR-0173: comando privado, gate fechado.
create function pcm.sso_vincular_ativo_levantamento(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_entidade_id uuid,p_local_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ator uuid:=auth.uid(); v_lote pcm.sso_levantamentos%rowtype; v_linha pcm.sso_levantamento_linhas%rowtype;
  v_cmd pcm.sso_levantamento_comandos%rowtype; v_pai pcm.sso_levantamento_incorporacoes%rowtype;
  v_codigo text; v_area uuid; v_parent uuid; v_referencia text; v_payload jsonb; v_resultado jsonb; v_existe boolean:=false;
begin
  if not coalesce((select habilitado from pcm.sso_levantamento_ativos_gate where chave),false) then raise exception 'incorporacao_ativos_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1
    or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_entidade_id is null or p_local_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('operacao','vincular_ativo','loteId',p_lote_id,'expectedRevision',p_expected_revision,'chave',p_chave,'entidadeId',p_entidade_id,'localId',p_local_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
  if found then
    if v_cmd.ator_id is distinct from v_ator or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_cmd.resultado;
  end if;
  if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
  if not found or v_linha.tipo not in ('sistema','equipamento','componente','grupo_quantitativo') or exists(select 1 from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id and linha_chave=p_chave)
    or exists(select 1 from pcm.sso_levantamento_rejeicoes where lote_id=p_lote_id and linha_chave=p_chave) then raise exception 'linha_indisponivel' using errcode='23514'; end if;
  select l.area_id into v_area from pcm.locais l join pcm.areas a on a.id=l.area_id where l.id=p_local_id and a.cliente_id=v_lote.cliente_id and l.ativo and a.ativo and l.deleted_at is null and a.deleted_at is null for key share of l,a;
  if v_area is null then raise exception 'local_invalido' using errcode='23514'; end if;
  if v_linha.tipo='sistema' then
    select s.codigo,true into v_codigo,v_existe from pcm.sistemas s where s.id=p_entidade_id and s.cliente_id=v_lote.cliente_id and s.area_id=v_area and s.ativo and s.deleted_at is null for update;
  elsif v_linha.tipo='grupo_quantitativo' then
    select true into v_existe from pcm.grupos_quantitativos g where g.id=p_entidade_id and g.cliente_id=v_lote.cliente_id and g.local_id=p_local_id and g.ativo and g.deleted_at is null for update;
  else
    select e.identificador,e.parent_item_id,true into v_codigo,v_parent,v_existe from pcm.equipamentos e where e.id=p_entidade_id and e.client_id=v_lote.cliente_id and e.local_id=p_local_id and e.tipo=v_linha.tipo and e.ativo and e.deleted_at is null for update;
  end if;
  if v_existe is distinct from true then raise exception 'ativo_indisponivel' using errcode='23514'; end if;
  if nullif(btrim(v_linha.atributos->>'codigoInformado'),'') is not null and v_linha.atributos->>'codigoInformado' is distinct from v_codigo then raise exception 'codigo_informado_divergente' using errcode='23514'; end if;
  v_referencia:=nullif(btrim(v_linha.atributos->>'referenciaPai'),'');
  if v_referencia is not null then
    select * into v_pai from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id and linha_chave=v_referencia;
    if not found or ((v_pai.tipo='area' and v_linha.tipo='sistema' and v_pai.entidade_id=v_area)
      or (v_pai.tipo in ('local','sublocal') and v_pai.entidade_id=p_local_id)
      or (v_pai.tipo='equipamento' and v_linha.tipo='componente' and v_pai.entidade_id=v_parent)) is not true then raise exception 'pai_incompativel' using errcode='23514'; end if;
  end if;
  update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
  insert into pcm.sso_levantamento_incorporacoes(lote_id,linha_chave,tipo,entidade_id,revisao,ator_id,request_id)
    values(p_lote_id,p_chave,v_linha.tipo,p_entidade_id,v_lote.revisao,v_ator,p_request_id);
  v_resultado:=jsonb_build_object('aggregateId',p_lote_id,'revision',v_lote.revisao,'state','pendente','created',false,
    'linkedIds',jsonb_build_object('entidadeId',p_entidade_id,'tipo',v_linha.tipo),'warnings','[]'::jsonb,'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.ativo_vinculado','sso_levantamentos',p_lote_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',v_lote.cliente_id,'linhaChave',p_chave,'entidadeId',p_entidade_id,'tipo',v_linha.tipo,'revision',v_lote.revisao));
  insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,v_ator,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_vincular_ativo_levantamento(uuid,uuid,integer,text,uuid,uuid) from public,anon,authenticated,service_role;
