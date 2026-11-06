-- ADR-1120: lista unificada experimental, sem mutação ou promoção.
create table pcm.sso_ranking_parciais_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_ranking_parciais_gate(id,habilitado) values(true,false);
alter table pcm.sso_ranking_parciais_gate enable row level security;
alter table pcm.sso_ranking_parciais_gate force row level security;
revoke all on pcm.sso_ranking_parciais_gate from public,anon,authenticated,service_role;

create function pcm.sso_ranking_backlog_com_parciais(p_ator_id uuid,p_cliente_id uuid,p_limite integer,p_apos_tipo text,p_apos_id uuid,p_apos_score text,p_assinatura text)
returns table(tipo text,id uuid,composicao_id uuid,pendencia_id uuid,alvo_tipo text,alvo_id uuid,score text,revisao integer,assinatura text)
language plpgsql volatile security definer set search_path='' as $$
declare v_assinatura text;v_score numeric;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_limite is null or p_limite not between 1 and 50
  or (p_apos_id is null and (p_apos_tipo is not null or p_apos_score is not null or p_assinatura is not null))
  or (p_apos_id is not null and (p_apos_tipo is null or p_apos_tipo not in ('composicao','retorno','retorno_parcial') or p_assinatura is null or length(p_assinatura)<>32))
  or (p_apos_score is not null and (length(p_apos_score)>42 or p_apos_score !~ '^[0-5](\.[0-9]{1,40})?$')) then
  raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if p_apos_score is not null then v_score:=p_apos_score::numeric; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_ranking_parciais_gate where id and habilitado for share;
 if not found then raise exception 'ranking_parciais_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_ranking_consistente_gate where id and habilitado for share;
 if not found then raise exception 'ranking_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_retorno_ciclo_gate where id and habilitado for share;
 if not found then raise exception 'retorno_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_retorno_parcial_gate where id and habilitado for share;
 if not found then raise exception 'retorno_parcial_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
 if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select pg_catalog.md5(
  coalesce((select pg_catalog.string_agg(pg_catalog.concat_ws(':',c.id,c.revisao,c.alvo_tipo,c.alvo_id,c.gravidade,c.urgencia,c.tendencia,c.dor_cliente,
   exists(select 1 from pcm.sso_backlog_chamado_vinculos v where v.composicao_id=c.id)),',' order by c.id) from pcm.sso_backlog_composicoes c where c.cliente_id=p_cliente_id),'')||'|'||
  coalesce((select pg_catalog.string_agg(b.composicao_id::text||':'||b.pendencia_id::text,',' order by b.composicao_id,b.pendencia_id)
   from pcm.sso_backlog_pendencias b join pcm.sso_backlog_composicoes c on c.id=b.composicao_id where c.cliente_id=p_cliente_id),'')||'|'||
  coalesce((select pg_catalog.string_agg(pg_catalog.concat_ws(':',r.id,r.ciclo_id,r.pendencia_id,r.estado,r.revisao),',' order by r.id)
   from pcm.sso_retornos_ciclo_backlog r where r.cliente_id=p_cliente_id),'')||'|'||
  coalesce((select pg_catalog.string_agg(pg_catalog.concat_ws(':',r.id,r.ciclo_id,r.pendencia_id,r.estado,r.revisao),',' order by r.id)
   from pcm.sso_retornos_parciais r where r.cliente_id=p_cliente_id),'')||'|'||
  coalesce((select pg_catalog.string_agg(pg_catalog.concat_ws(':',c.id,c.composicao_id,c.pendencia_id,c.cliente_id),',' order by c.id)
   from pcm.sso_ciclos_backlog c where c.cliente_id=p_cliente_id),'')||'|'||
  coalesce((select pg_catalog.concat_ws(':',cfg.peso_gravidade,cfg.peso_urgencia,cfg.peso_tendencia,cfg.peso_dor_cliente) from config.priorizacao_gutd cfg where cfg.id=1),'ausente')) into v_assinatura;
 if p_apos_id is not null and p_assinatura is distinct from v_assinatura then raise exception 'ranking_alterado_reinicie' using errcode='40001'; end if;
 return query with itens as (
  select 'composicao'::text as tipo,c.id,c.id as composicao_id,null::uuid as pendencia_id,c.alvo_tipo,c.alvo_id,c.revisao,
   pcm.sso_score_gutd(c.gravidade,c.urgencia,c.tendencia,c.dor_cliente,cfg.peso_gravidade,cfg.peso_urgencia,cfg.peso_tendencia,cfg.peso_dor_cliente) as score
   from pcm.sso_backlog_composicoes c left join config.priorizacao_gutd cfg on cfg.id=1 where c.cliente_id=p_cliente_id
   and exists(select 1 from pcm.sso_backlog_pendencias b where b.composicao_id=c.id)
   and not exists(select 1 from pcm.sso_backlog_chamado_vinculos v where v.composicao_id=c.id)
  union all
  select 'retorno'::text,r.id,c.id,r.pendencia_id,c.alvo_tipo,c.alvo_id,r.revisao,
   pcm.sso_score_gutd(c.gravidade,c.urgencia,c.tendencia,c.dor_cliente,cfg.peso_gravidade,cfg.peso_urgencia,cfg.peso_tendencia,cfg.peso_dor_cliente)
   from pcm.sso_retornos_ciclo_backlog r join pcm.sso_ciclos_backlog ci on ci.id=r.ciclo_id and ci.cliente_id=r.cliente_id and ci.pendencia_id=r.pendencia_id
   join pcm.sso_backlog_composicoes c on c.id=ci.composicao_id and c.cliente_id=r.cliente_id left join config.priorizacao_gutd cfg on cfg.id=1
   where r.cliente_id=p_cliente_id and r.estado='aguardando'
  union all
  select 'retorno_parcial'::text,r.id,c.id,r.pendencia_id,c.alvo_tipo,c.alvo_id,r.revisao,
   pcm.sso_score_gutd(c.gravidade,c.urgencia,c.tendencia,c.dor_cliente,cfg.peso_gravidade,cfg.peso_urgencia,cfg.peso_tendencia,cfg.peso_dor_cliente)
   from pcm.sso_retornos_parciais r join pcm.sso_ciclos_backlog ci on ci.id=r.ciclo_id and ci.cliente_id=r.cliente_id and ci.pendencia_id=r.pendencia_id
    and ci.chamado_id=r.chamado_id and ci.parcela_id=r.parcela_id
   join pcm.sso_backlog_composicoes c on c.id=ci.composicao_id and c.cliente_id=r.cliente_id left join config.priorizacao_gutd cfg on cfg.id=1
   where r.cliente_id=p_cliente_id and r.estado='aguardando'
 ) select i.tipo,i.id,i.composicao_id,i.pendencia_id,i.alvo_tipo,i.alvo_id,i.score::text,i.revisao,v_assinatura from itens i
  where p_apos_id is null or (v_score is null and i.score is null and (i.tipo,i.id)>(p_apos_tipo,p_apos_id))
   or (v_score is not null and (i.score is null or i.score<v_score or (i.score=v_score and (i.tipo,i.id)>(p_apos_tipo,p_apos_id))))
  order by i.score desc nulls last,i.tipo,i.id limit p_limite;
end; $$;
revoke all on function pcm.sso_ranking_backlog_com_parciais(uuid,uuid,integer,text,uuid,text,text) from public,anon,authenticated,service_role;
