-- ADR-0672: acesso pontual, mesma fórmula do ranking 0661.
create function pcm.sso_consultar_composicao_backlog(p_cliente_id uuid,p_composicao_id uuid)
returns table(id uuid,alvo_tipo text,alvo_id uuid,revisao integer,gravidade smallint,urgencia smallint,tendencia smallint,dor_cliente smallint,score numeric,total bigint,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_divisao_backlog_gate where id),false) or not coalesce((select habilitado from pcm.sso_ranking_consistente_gate where id),false) then raise exception 'consulta_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_composicao_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select c.id,c.alvo_tipo,c.alvo_id,c.revisao,c.gravidade,c.urgencia,c.tendencia,c.dor_cliente,
 case when cfg.id is null or c.gravidade is null or c.urgencia is null or c.tendencia is null or c.dor_cliente is null or cfg.peso_gravidade is null or cfg.peso_urgencia is null or cfg.peso_tendencia is null or cfg.peso_dor_cliente is null or cfg.peso_gravidade+cfg.peso_urgencia+cfg.peso_tendencia+cfg.peso_dor_cliente<>100 then null::numeric
 else (cfg.peso_gravidade*c.gravidade+cfg.peso_urgencia*c.urgencia+cfg.peso_tendencia*c.tendencia+cfg.peso_dor_cliente*c.dor_cliente)::numeric/100 end,
 (select count(*) from pcm.sso_backlog_pendencias b where b.composicao_id=c.id),c.criado_em
 from pcm.sso_backlog_composicoes c left join config.priorizacao_gutd cfg on cfg.id=1 where c.id=p_composicao_id and c.cliente_id=p_cliente_id;
end; $$;
revoke all on function pcm.sso_consultar_composicao_backlog(uuid,uuid) from public,anon,authenticated,service_role;
