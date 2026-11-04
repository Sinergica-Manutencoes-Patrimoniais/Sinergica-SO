-- ADR-0962: cálculo puro privado e substituição do ranking já privado.
create function pcm.sso_score_gutd(p_g smallint,p_u smallint,p_t smallint,p_d smallint,
  p_wg integer,p_wu integer,p_wt integer,p_wd integer) returns numeric
language plpgsql immutable security invoker set search_path='' as $$
declare v_soma integer;v_gut integer;
begin
  if p_g is null or p_u is null or p_t is null or p_g not between 1 and 5 or p_u not between 1 and 5 or p_t not between 1 and 5
    or (p_d is not null and p_d not between 1 and 5) or p_wg is null or p_wu is null or p_wt is null or p_wd is null
    or p_wg not between 0 and 100 or p_wu not between 0 and 100 or p_wt not between 0 and 100 or p_wd not between 0 and 100 then return null; end if;
  v_soma:=p_wg+p_wu+p_wt+p_wd;
  if v_soma<>100 then return null; end if;
  if p_d is null then
    v_gut:=p_wg+p_wu+p_wt;
    if v_gut=0 then return null; end if;
    return (p_wg*p_g+p_wu*p_u+p_wt*p_t)::numeric/v_gut;
  end if;
  return (p_wg*p_g+p_wu*p_u+p_wt*p_t+p_wd*p_d)::numeric/100;
end; $$;
revoke all on function pcm.sso_score_gutd(smallint,smallint,smallint,smallint,integer,integer,integer,integer) from public,anon,authenticated,service_role;

create or replace function pcm.sso_listar_ranking_backlog_consistente(p_cliente_id uuid,p_limite integer,p_apos_id uuid,p_apos_score numeric,p_assinatura text)
returns table(id uuid,alvo_tipo text,alvo_id uuid,revisao integer,gravidade smallint,urgencia smallint,tendencia smallint,dor_cliente smallint,score numeric,total bigint,criado_em timestamptz,assinatura text)
language plpgsql stable security definer set search_path='' as $$
declare v_assinatura text;
begin
  if not coalesce((select g.habilitado from pcm.sso_ranking_consistente_gate g where g.id),false) then raise exception 'ranking_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_limite is null or p_limite not between 1 and 100
    or (p_apos_id is null and (p_apos_score is not null or p_assinatura is not null))
    or (p_apos_id is not null and (p_assinatura is null or length(p_assinatura)<>32)) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select pg_catalog.md5(coalesce((select pg_catalog.string_agg(c.id::text||':'||c.revisao::text||':'||coalesce(c.gravidade::text,'-')||':'||coalesce(c.urgencia::text,'-')||':'||coalesce(c.tendencia::text,'-')||':'||coalesce(c.dor_cliente::text,'-'),',' order by c.id) from pcm.sso_backlog_composicoes c where c.cliente_id=p_cliente_id),'')||'|'||coalesce((select pg_catalog.string_agg(b.composicao_id::text||':'||b.pendencia_id::text,',' order by b.composicao_id,b.pendencia_id) from pcm.sso_backlog_pendencias b join pcm.sso_backlog_composicoes c on c.id=b.composicao_id where c.cliente_id=p_cliente_id),'')||'|'||coalesce((select pg_catalog.concat_ws(':',cfg.peso_gravidade,cfg.peso_urgencia,cfg.peso_tendencia,cfg.peso_dor_cliente) from config.priorizacao_gutd cfg where cfg.id=1),'ausente')) into v_assinatura;
  if p_apos_id is not null and p_assinatura is distinct from v_assinatura then raise exception 'ranking_alterado_reinicie' using errcode='40001'; end if;
  return query with pontuados as (
    select c.id,c.alvo_tipo,c.alvo_id,c.revisao,c.gravidade,c.urgencia,c.tendencia,c.dor_cliente,c.criado_em,
      pcm.sso_score_gutd(c.gravidade,c.urgencia,c.tendencia,c.dor_cliente,cfg.peso_gravidade::integer,cfg.peso_urgencia::integer,cfg.peso_tendencia::integer,cfg.peso_dor_cliente::integer) as score,
      (select count(*) from pcm.sso_backlog_pendencias b where b.composicao_id=c.id) as total
    from pcm.sso_backlog_composicoes c left join config.priorizacao_gutd cfg on cfg.id=1 where c.cliente_id=p_cliente_id
  ) select p.id,p.alvo_tipo,p.alvo_id,p.revisao,p.gravidade,p.urgencia,p.tendencia,p.dor_cliente,p.score,p.total,p.criado_em,v_assinatura from pontuados p
    where p_apos_id is null or (p_apos_score is null and p.score is null and p.id>p_apos_id)
      or (p_apos_score is not null and (p.score is null or p.score<p_apos_score or (p.score=p_apos_score and p.id>p_apos_id)))
    order by p.score desc nulls last,p.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_ranking_backlog_consistente(uuid,integer,uuid,numeric,text) from public,anon,authenticated,service_role;
