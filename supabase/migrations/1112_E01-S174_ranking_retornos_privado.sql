-- ADR-0963: ranking separado, privado; não representa fila oficial.
create function pcm.sso_ranking_retornos_ciclo(p_cliente_id uuid,p_limite integer,p_apos_id uuid,p_apos_score numeric,p_assinatura text)
returns table(id uuid,pendencia_id uuid,composicao_id uuid,alvo_tipo text,alvo_id uuid,gravidade smallint,urgencia smallint,
  tendencia smallint,dor_cliente smallint,score numeric,revisao integer,assinatura text)
language plpgsql volatile security definer set search_path='' as $$
declare v_assinatura text;
begin
  perform 1 from pcm.sso_retorno_ciclo_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'retorno_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_ciclos_backlog_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_limite is null or p_limite not between 1 and 50
    or (p_apos_id is null and (p_apos_score is not null or p_assinatura is not null))
    or (p_apos_id is not null and (p_assinatura is null or length(p_assinatura)<>32)) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select pg_catalog.md5(coalesce((select pg_catalog.string_agg(pg_catalog.concat_ws(':',r.id,r.revisao,r.estado,c.id,c.revisao,
    coalesce(c.gravidade::text,'-'),coalesce(c.urgencia::text,'-'),coalesce(c.tendencia::text,'-'),coalesce(c.dor_cliente::text,'-')),',' order by r.id)
    from pcm.sso_retornos_ciclo_backlog r join pcm.sso_ciclos_backlog ci on ci.id=r.ciclo_id and ci.cliente_id=r.cliente_id
    join pcm.sso_backlog_composicoes c on c.id=ci.composicao_id and c.cliente_id=r.cliente_id where r.cliente_id=p_cliente_id and r.estado='aguardando'),'')
    ||'|'||coalesce((select pg_catalog.concat_ws(':',cfg.peso_gravidade,cfg.peso_urgencia,cfg.peso_tendencia,cfg.peso_dor_cliente) from config.priorizacao_gutd cfg where cfg.id=1),'ausente')) into v_assinatura;
  if p_apos_id is not null and p_assinatura is distinct from v_assinatura then raise exception 'ranking_alterado_reinicie' using errcode='40001'; end if;
  return query with pontuados as (
    select r.id,r.pendencia_id,c.id as composicao_id,c.alvo_tipo,c.alvo_id,c.gravidade,c.urgencia,c.tendencia,c.dor_cliente,r.revisao,
      pcm.sso_score_gutd(c.gravidade,c.urgencia,c.tendencia,c.dor_cliente,cfg.peso_gravidade,cfg.peso_urgencia,cfg.peso_tendencia,cfg.peso_dor_cliente) as score
    from pcm.sso_retornos_ciclo_backlog r join pcm.sso_ciclos_backlog ci on ci.id=r.ciclo_id and ci.cliente_id=r.cliente_id and ci.pendencia_id=r.pendencia_id
    join pcm.sso_backlog_composicoes c on c.id=ci.composicao_id and c.cliente_id=r.cliente_id
    left join config.priorizacao_gutd cfg on cfg.id=1 where r.cliente_id=p_cliente_id and r.estado='aguardando'
  ) select p.id,p.pendencia_id,p.composicao_id,p.alvo_tipo,p.alvo_id,p.gravidade,p.urgencia,p.tendencia,p.dor_cliente,p.score,p.revisao,v_assinatura
    from pontuados p where p_apos_id is null or (p_apos_score is null and p.score is null and p.id>p_apos_id)
      or (p_apos_score is not null and (p.score is null or p.score<p_apos_score or (p.score=p_apos_score and p.id>p_apos_id)))
    order by p.score desc nulls last,p.id limit p_limite;
end; $$;
revoke all on function pcm.sso_ranking_retornos_ciclo(uuid,integer,uuid,numeric,text) from public,anon,authenticated,service_role;
