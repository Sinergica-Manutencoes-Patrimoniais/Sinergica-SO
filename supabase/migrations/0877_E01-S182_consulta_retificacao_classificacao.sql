create function comercial.sso_consultar_retificacao_classificacao(p_cliente_id uuid,p_classificacao_id uuid)
returns table(retificacao_id uuid,tipo_proposto text,motivo text,ator_id uuid,criado_em timestamptz,revisao_id uuid,decisao text,motivo_revisao text,revisor_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from comercial.sso_retificacao_classificacao_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or (config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true and config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not exists(select 1 from comercial.sso_classificacoes_linha where id=p_classificacao_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select r.id,r.tipo_proposto,r.motivo,r.ator_id,r.criado_em,v.id,v.decisao,v.motivo,v.ator_id from comercial.sso_retificacoes_classificacao_linha r left join comercial.sso_revisoes_retificacao_classificacao v on v.retificacao_id=r.id where r.classificacao_id=p_classificacao_id and r.cliente_id=p_cliente_id;
end $$;
revoke all on function comercial.sso_consultar_retificacao_classificacao(uuid,uuid) from public,anon,authenticated,service_role;
