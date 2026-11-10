-- ADR-0151: sem concessão e sem aplicação operacional.
alter table pcm.sso_backlog_composicoes
  add column gravidade smallint check(gravidade between 1 and 5),
  add column urgencia smallint check(urgencia between 1 and 5),
  add column tendencia smallint check(tendencia between 1 and 5),
  add column dor_cliente smallint check(dor_cliente between 1 and 5),
  add constraint sso_backlog_gut_completo check(num_nonnulls(gravidade,urgencia,tendencia) in (0,3));

create function pcm.sso_priorizar_composicao(p_request_id uuid,p_id uuid,p_revisao integer,p_g smallint,p_u smallint,p_t smallint,p_d smallint,p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ator uuid := auth.uid(); v_c pcm.sso_backlog_composicoes%rowtype; v_cmd pcm.sso_backlog_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_backlog_composicao_gate where id),false) then raise exception 'composicao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_id is null or p_revisao is null or p_revisao < 1
    or p_g is null or p_g not between 1 and 5 or p_u is null or p_u not between 1 and 5 or p_t is null or p_t not between 1 and 5
    or (p_d is not null and p_d not between 1 and 5) or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('operacao','priorizar','id',p_id,'revisao',p_revisao,'g',p_g,'u',p_u,'t',p_t,'d',p_d,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('backlog:' || p_request_id::text,0));
  select * into v_cmd from pcm.sso_backlog_comandos where request_id=p_request_id;
  if found then
    if v_cmd.ator_id is distinct from v_ator or config.sso_autorizar_acao('execucao.validar',v_cmd.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_cmd.resultado;
  end if;
  select * into v_c from pcm.sso_backlog_composicoes where id=p_id for update;
  if not found or config.sso_autorizar_acao('execucao.validar',v_c.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_c.revisao<>p_revisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  update pcm.sso_backlog_composicoes set gravidade=p_g,urgencia=p_u,tendencia=p_t,dor_cliente=p_d,revisao=revisao+1 where id=p_id returning * into v_c;
  v_resultado:=jsonb_build_object('aggregateId',p_id,'revision',v_c.revisao,'requestId',p_request_id);
  insert into pcm.sso_backlog_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,v_ator,v_c.cliente_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'backlog.priorizado','sso_backlog_composicoes',p_id,v_payload || jsonb_build_object('requestId',p_request_id,'revision',v_c.revisao));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_priorizar_composicao(uuid,uuid,integer,smallint,smallint,smallint,smallint,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_composicoes_backlog(p_cliente_id uuid,p_limite integer,p_apos_id uuid default null,p_apos_score numeric default null)
returns table(id uuid,alvo_tipo text,alvo_id uuid,revisao integer,gravidade smallint,urgencia smallint,tendencia smallint,dor_cliente smallint,score numeric,total bigint,criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos_id is null and p_apos_score is not null) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query with pontuados as (
    select c.id,c.alvo_tipo,c.alvo_id,c.revisao,c.gravidade,c.urgencia,c.tendencia,c.dor_cliente,c.criado_em,
      case when c.gravidade is null or cfg.id is null then null
        when c.dor_cliente is not null then (cfg.peso_gravidade*c.gravidade+cfg.peso_urgencia*c.urgencia+cfg.peso_tendencia*c.tendencia+cfg.peso_dor_cliente*c.dor_cliente)::numeric/100
        when cfg.peso_gravidade+cfg.peso_urgencia+cfg.peso_tendencia=0 then null::numeric
        else (cfg.peso_gravidade*c.gravidade+cfg.peso_urgencia*c.urgencia+cfg.peso_tendencia*c.tendencia)::numeric/(cfg.peso_gravidade+cfg.peso_urgencia+cfg.peso_tendencia) end as score,
      (select count(*) from pcm.sso_backlog_pendencias b where b.composicao_id=c.id) as total
    from pcm.sso_backlog_composicoes c left join config.priorizacao_gutd cfg on cfg.id=1 where c.cliente_id=p_cliente_id
  ) select p.id,p.alvo_tipo,p.alvo_id,p.revisao,p.gravidade,p.urgencia,p.tendencia,p.dor_cliente,p.score,p.total,p.criado_em
    from pontuados p where p_apos_id is null or
      (p_apos_score is null and p.score is null and p.id>p_apos_id) or
      (p_apos_score is not null and (p.score is null or p.score<p_apos_score or (p.score=p_apos_score and p.id>p_apos_id)))
    order by p.score desc nulls last,p.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_composicoes_backlog(uuid,integer,uuid,numeric) from public,anon,authenticated,service_role;
