-- ADR-0250: comando privado, sem criar ativos ou OS.
create function pcm.sso_consultar_grupo_para_levantamento(p_cliente_id uuid,p_grupo_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_g pcm.grupos_quantitativos%rowtype;
begin
  if config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_g from pcm.grupos_quantitativos where id=p_grupo_id and cliente_id=p_cliente_id and ativo and deleted_at is null;
  if not found then raise exception 'grupo_indisponivel' using errcode='42501'; end if;
  return jsonb_build_object('id',v_g.id,'nome',v_g.nome,'localId',v_g.local_id,'categoriaId',v_g.categoria_id,'sistemaId',v_g.sistema_id,'quantidade',v_g.quantidade,'caracteristicas',v_g.caracteristicas,'revision',v_g.revisao);
end;
$$;
revoke all on function pcm.sso_consultar_grupo_para_levantamento(uuid,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_atualizar_grupo_levantamento(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_grupo_id uuid,p_grupo_revision integer,p_local_id uuid,p_caracteristicas jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_g pcm.grupos_quantitativos%rowtype;v_antes pcm.grupos_quantitativos%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;v_q numeric;v_nome text;v_payload jsonb;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_levantamento_ativos_gate where chave),false) then raise exception 'incorporacao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_grupo_id is null or p_grupo_revision is null or p_grupo_revision<1 or p_local_id is null or jsonb_typeof(p_caracteristicas) is distinct from 'object' or pg_column_size(p_caracteristicas)>16384 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if exists(select 1 from jsonb_each(p_caracteristicas) e where jsonb_typeof(e.value) is distinct from 'string' or length(btrim(e.key)) not between 1 and 200 or length(e.value #>> '{}')>4000) then raise exception 'caracteristicas_invalidas' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('operacao','atualizar_grupo','loteId',p_lote_id,'expectedRevision',p_expected_revision,'chave',p_chave,'grupoId',p_grupo_id,'grupoRevision',p_grupo_revision,'localId',p_local_id,'caracteristicas',p_caracteristicas);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
  if found then
    if v_cmd.ator_id is distinct from v_ator or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_cmd.resultado;
  end if;
  if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
  if not found or v_linha.tipo<>'grupo_quantitativo' or exists(select 1 from pcm.sso_levantamento_rejeicoes where lote_id=p_lote_id and linha_chave=p_chave) or exists(select 1 from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id and linha_chave=p_chave) then raise exception 'linha_indisponivel' using errcode='23514'; end if;
  if exists(select 1 from jsonb_each(v_linha.atributos) a where a.key not in ('nome','quantidade') and a.value<>'null'::jsonb and a.value<>'""'::jsonb) then raise exception 'atributos_nao_suportados' using errcode='23514'; end if;
  v_nome:=btrim(v_linha.atributos->>'nome');
  if jsonb_typeof(v_linha.atributos->'nome') is distinct from 'string' or length(v_nome) not between 1 and 200 or coalesce(v_linha.atributos->>'quantidade','') !~ '^[1-9][0-9]{0,15}$' then raise exception 'nome_ou_quantidade_invalida' using errcode='22023'; end if;
  v_q:=(v_linha.atributos->>'quantidade')::numeric;if v_q>9007199254740991 then raise exception 'quantidade_invalida' using errcode='22023'; end if;
  select * into v_g from pcm.grupos_quantitativos where id=p_grupo_id and cliente_id=v_lote.cliente_id and local_id=p_local_id and ativo and deleted_at is null for update;
  if not found then raise exception 'grupo_indisponivel' using errcode='23514'; end if;
  if v_g.revisao<>p_grupo_revision then raise exception 'grupo_revisao_obsoleta' using errcode='40001'; end if;
  v_antes:=v_g;
  update pcm.grupos_quantitativos set nome=v_nome,quantidade=v_q::bigint,caracteristicas=p_caracteristicas,revisao=revisao+1,updated_at=now(),updated_by=v_ator where id=p_grupo_id returning * into v_g;
  update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
  insert into pcm.sso_levantamento_incorporacoes(lote_id,linha_chave,tipo,entidade_id,revisao,ator_id,request_id) values(p_lote_id,p_chave,'grupo_quantitativo',p_grupo_id,v_lote.revisao,v_ator,p_request_id);
  v_resultado:=jsonb_build_object('aggregateId',p_lote_id,'revision',v_lote.revisao,'state','pendente','created',false,'linkedIds',jsonb_build_object('entidadeId',p_grupo_id,'tipo','grupo_quantitativo'),'warnings','[]'::jsonb,'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'grupo.atualizado','grupos_quantitativos',p_grupo_id,jsonb_build_object('requestId',p_request_id,'antes',to_jsonb(v_antes),'depois',to_jsonb(v_g)));
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.grupo_atualizado','sso_levantamentos',p_lote_id,v_resultado||jsonb_build_object('clienteId',v_lote.cliente_id,'linhaChave',p_chave));
  insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,v_ator,v_payload,v_resultado);return v_resultado;
end;
$$;
revoke all on function pcm.sso_atualizar_grupo_levantamento(uuid,uuid,integer,text,uuid,integer,uuid,jsonb) from public,anon,authenticated,service_role;
