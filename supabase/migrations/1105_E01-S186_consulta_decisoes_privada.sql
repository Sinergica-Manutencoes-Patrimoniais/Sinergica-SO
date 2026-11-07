-- ADR-0951: consulta privada, sem concessão operacional.
create function pcm.sso_listar_decisoes_onda(
  p_cliente_id uuid,p_onda smallint,p_antes timestamptz,p_antes_id uuid,p_limite integer
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_revision integer;v_itens jsonb;
begin
  perform 1 from pcm.sso_decisao_onda_gate where id and habilitado for share;
  if not found then raise exception 'decisao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_evidencias_ondas_gate where id and habilitado for share;
  if not found then raise exception 'evidencias_desabilitadas' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_onda is null or p_onda not between 1 and 6
    or p_limite is null or p_limite not between 1 and 25 or (p_antes is null)<>(p_antes_id is null) then
    raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select revisao into v_revision from pcm.sso_ondas_homologacao where cliente_id=p_cliente_id and onda=p_onda for share;
  v_revision:=coalesce(v_revision,0);
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'atorId',d.ator_id,'criadoEm',d.criado_em,
    'revision',d.revisao_evidencias,'versao',d.versao,'ambiente',d.ambiente,'ressalva',d.ressalva,
    'referencias',d.referencias,'evidencias',d.evidencias) order by d.criado_em desc,d.id desc),'[]'::jsonb)
    into v_itens from (select id,ator_id,criado_em,revisao_evidencias,versao,ambiente,ressalva,referencias,evidencias
      from pcm.sso_decisoes_onda where cliente_id=p_cliente_id and onda=p_onda
        and (p_antes is null or (criado_em,id)<(p_antes,p_antes_id))
      order by criado_em desc,id desc limit p_limite) d;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return jsonb_build_object('clienteId',p_cliente_id,'onda',p_onda,'revisionAtual',v_revision,'itens',v_itens);
end; $$;
revoke all on function pcm.sso_listar_decisoes_onda(uuid,smallint,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
