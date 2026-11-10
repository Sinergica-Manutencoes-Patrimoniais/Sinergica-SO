-- ADR-0182: preparação privada; não conceder EXECUTE ou habilitar gate.
create function pcm.sso_snapshot_ativo_levantamento(p_cliente_id uuid,p_tipo text,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if p_cliente_id is null or p_id is null or p_tipo is null or p_tipo not in ('sistema','equipamento','componente','grupo_quantitativo') then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_tipo='sistema' then
    select jsonb_build_object('id',s.id,'nome',s.nome,'codigo',s.codigo,'areaId',s.area_id,'localId',s.local_id,'categoriaId',s.categoria_id) into v
      from pcm.sistemas s where s.id=p_id and s.cliente_id=p_cliente_id and s.ativo and s.deleted_at is null;
  elsif p_tipo='grupo_quantitativo' then
    select jsonb_build_object('id',g.id,'nome',g.nome,'codigo',null,'localId',g.local_id,'categoriaId',g.categoria_id,'sistemaId',g.sistema_id,'revisao',g.revisao) into v
      from pcm.grupos_quantitativos g where g.id=p_id and g.cliente_id=p_cliente_id and g.ativo and g.deleted_at is null;
  else
    select jsonb_build_object('id',e.id,'nome',e.nome,'codigo',e.identificador,'localId',e.local_id,'parentId',e.parent_item_id,'categoriaId',e.categoria_id,'revisao',e.estrutura_revisao) into v
      from pcm.equipamentos e where e.id=p_id and e.client_id=p_cliente_id and e.tipo=p_tipo and e.ativo and e.deleted_at is null;
  end if;
  if v is null then raise exception 'ativo_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return v;
end;
$$;
revoke all on function pcm.sso_snapshot_ativo_levantamento(uuid,text,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_atualizar_nome_ativo_levantamento(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_entidade_id uuid,p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ator uuid:=auth.uid(); v_lote pcm.sso_levantamentos%rowtype; v_linha pcm.sso_levantamento_linhas%rowtype;
  v_cmd pcm.sso_levantamento_comandos%rowtype; v_atual jsonb; v_depois jsonb; v_nome text; v_payload jsonb; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_levantamento_ativos_gate where chave),false) then raise exception 'incorporacao_ativos_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_entidade_id is null
    or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or jsonb_typeof(p_snapshot) is distinct from 'object' then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('operacao','atualizar_nome','loteId',p_lote_id,'expectedRevision',p_expected_revision,'chave',p_chave,'entidadeId',p_entidade_id,'snapshot',p_snapshot);
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
  if nullif(btrim(v_linha.atributos->>'referenciaPai'),'') is not null then raise exception 'referencia_pai_exige_vinculo' using errcode='23514'; end if;
  if exists (select 1 from jsonb_each(v_linha.atributos) a where a.key not in ('nome','codigoInformado','referenciaPai') and a.value <> 'null'::jsonb and a.value <> '""'::jsonb) then
    raise exception 'atributos_nao_suportados_para_atualizacao' using errcode='23514'; end if;
  if jsonb_typeof(v_linha.atributos->'nome') is distinct from 'string' then raise exception 'nome_invalido' using errcode='22023'; end if;
  v_nome:=btrim(v_linha.atributos->>'nome'); if length(v_nome) not between 1 and 200 then raise exception 'nome_invalido' using errcode='22023'; end if;
  if v_linha.tipo='sistema' then perform 1 from pcm.sistemas where id=p_entidade_id and cliente_id=v_lote.cliente_id for update;
  elsif v_linha.tipo='grupo_quantitativo' then perform 1 from pcm.grupos_quantitativos where id=p_entidade_id and cliente_id=v_lote.cliente_id for update;
  else perform 1 from pcm.equipamentos where id=p_entidade_id and client_id=v_lote.cliente_id for update; end if;
  if not found then raise exception 'ativo_indisponivel' using errcode='23514'; end if;
  v_atual:=pcm.sso_snapshot_ativo_levantamento(v_lote.cliente_id,v_linha.tipo,p_entidade_id);
  if v_atual is distinct from p_snapshot then raise exception 'cadastro_divergente' using errcode='40001'; end if;
  if nullif(btrim(v_linha.atributos->>'codigoInformado'),'') is not null and v_linha.atributos->>'codigoInformado' is distinct from v_atual->>'codigo' then raise exception 'codigo_informado_divergente' using errcode='23514'; end if;
  if v_linha.tipo='sistema' then update pcm.sistemas set nome=v_nome,updated_by=v_ator where id=p_entidade_id;
  elsif v_linha.tipo='grupo_quantitativo' then update pcm.grupos_quantitativos set nome=v_nome,revisao=revisao+1,updated_at=now(),updated_by=v_ator where id=p_entidade_id;
  else update pcm.equipamentos set nome=v_nome,updated_by=v_ator where id=p_entidade_id; end if;
  v_depois:=pcm.sso_snapshot_ativo_levantamento(v_lote.cliente_id,v_linha.tipo,p_entidade_id);
  update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
  insert into pcm.sso_levantamento_incorporacoes(lote_id,linha_chave,tipo,entidade_id,revisao,ator_id,request_id) values(p_lote_id,p_chave,v_linha.tipo,p_entidade_id,v_lote.revisao,v_ator,p_request_id);
  v_resultado:=jsonb_build_object('aggregateId',p_lote_id,'revision',v_lote.revisao,'state','pendente','created',false,'linkedIds',jsonb_build_object('entidadeId',p_entidade_id,'tipo',v_linha.tipo),'warnings',jsonb_build_array('somente_nome_atualizado'),'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.nome_atualizado','sso_levantamentos',p_lote_id,jsonb_build_object('requestId',p_request_id,'clienteId',v_lote.cliente_id,'linhaChave',p_chave,'antes',v_atual,'depois',v_depois));
  insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,v_ator,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_atualizar_nome_ativo_levantamento(uuid,uuid,integer,text,uuid,jsonb) from public,anon,authenticated,service_role;
