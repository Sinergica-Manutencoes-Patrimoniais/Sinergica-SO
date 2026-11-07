-- ADR-0139: consultas e conferência preparadas, sem concessão de execução.
create function pcm.sso_listar_cronogramas_unificados(p_cliente_id uuid, p_apos uuid, p_limite integer)
returns table(id uuid, fonte_id text, revisao integer, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then
    raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then
    raise exception 'lote_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select l.id, substring(l.chave_origem from 12), l.revisao, l.criado_em
    from pcm.sso_levantamentos l where l.cliente_id=p_cliente_id and l.origem='planilha'
    and l.chave_origem like 'cronograma:%' and jsonb_typeof(l.conteudo)='array'
    and exists(select 1 from pcm.sso_levantamento_linhas ln where ln.lote_id=l.id and ln.tipo='cronograma')
    and (p_apos is null or l.id>p_apos) order by l.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_cronogramas_unificados(uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_obter_cronograma_unificado(p_cliente_id uuid, p_lote_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_lote pcm.sso_levantamentos%rowtype;
begin
  if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then
    raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then
    raise exception 'lote_sem_acesso' using errcode='42501'; end if;
  select * into v_lote from pcm.sso_levantamentos l where l.id=p_lote_id and l.cliente_id=p_cliente_id
    and l.origem='planilha' and l.chave_origem like 'cronograma:%' and jsonb_typeof(l.conteudo)='array'
    and exists(select 1 from pcm.sso_levantamento_linhas ln where ln.lote_id=l.id and ln.tipo='cronograma');
  if not found then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
  return jsonb_build_object('id',v_lote.id,'clienteId',v_lote.cliente_id,
    'fonteId',substring(v_lote.chave_origem from 12),'revision',v_lote.revisao,'matriz',v_lote.conteudo);
end;
$$;
revoke all on function pcm.sso_obter_cronograma_unificado(uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_anotar_cronograma_unificado(
 p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_numero_linha integer,p_observacao text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_lote pcm.sso_levantamentos%rowtype;
  v_comando pcm.sso_levantamento_comandos%rowtype; v_payload jsonb; v_resultado jsonb; v_id uuid;
begin
  if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then
    raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_lote_id is null or p_expected_revision is null
    or p_expected_revision < 1 or p_numero_linha is null or p_numero_linha < 1
    or p_observacao is null or length(btrim(p_observacao)) not between 1 and 2000 then
    raise exception 'revisao_invalida' using errcode='22023'; end if;
  v_payload := jsonb_build_object('tipo','anotarCronograma','loteId',p_lote_id,
    'expectedRevision',p_expected_revision,'numeroLinha',p_numero_linha,'observacao',btrim(p_observacao));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into v_comando from pcm.sso_levantamento_comandos where request_id=p_request_id;
  select * into v_lote from pcm.sso_levantamentos l where l.id=p_lote_id and l.origem='planilha'
    and l.chave_origem like 'cronograma:%' for update;
  if not found or config.sso_autorizar_acao('plano.gerir',v_lote.cliente_id) is distinct from true then
    raise exception 'lote_sem_acesso' using errcode='42501'; end if;
  if v_comando.request_id is not null then
    if v_comando.ator_id is distinct from v_actor or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_comando.resultado;
  end if;
  if v_lote.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if not exists(select 1 from pcm.sso_levantamento_linhas where lote_id=p_lote_id
    and chave=p_numero_linha::text and tipo='cronograma') then
    raise exception 'linha_inexistente' using errcode='23514'; end if;
  update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
  insert into pcm.sso_levantamento_conferencias(lote_id,chave_linha,revisao_lote,observacao,ator_id)
    values(p_lote_id,p_numero_linha::text,v_lote.revisao,btrim(p_observacao),v_actor) returning id into v_id;
  v_resultado := jsonb_build_object('aggregateId',p_lote_id,'revision',v_lote.revisao,
    'state','pendente','created',true,'requestId',p_request_id,'anotacaoId',v_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload)
    values(v_actor,'cronograma.revisado','sso_levantamentos',p_lote_id,
      jsonb_build_object('requestId',p_request_id,'linha',p_numero_linha,'revision',v_lote.revisao));
  insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado)
    values(p_request_id,v_actor,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_anotar_cronograma_unificado(uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
