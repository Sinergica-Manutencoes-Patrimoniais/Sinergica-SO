-- ADR-0434: leitura paginada das transições preparadas, sem mudanças de estado.
create function pcm.sso_historico_transicoes_plano(p_cliente_id uuid,p_plano_id uuid,p_antes integer default null,p_limite integer default 20)
returns table(id uuid,revisao integer,acao text,estado_anterior text,estado_novo text,vigencia date,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.plano_transicao_gate where id),false) then raise exception 'transicao_plano_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 50 or (p_antes is not null and p_antes<1) then raise exception 'consulta_invalida' using errcode='22023'; end if;
 return query select h.id,h.revisao,h.acao,h.estado_anterior,h.estado_novo,h.vigencia,h.motivo,h.ator_id,h.criado_em from pcm.plano_transicoes_historico h where h.plano_id=p_plano_id and (p_antes is null or h.revisao<p_antes) order by h.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_transicoes_plano(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
