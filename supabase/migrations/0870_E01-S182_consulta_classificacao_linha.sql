create function comercial.sso_listar_classificacao_linhas(p_cliente_id uuid,p_proposta_id uuid,p_versao integer,p_apos uuid,p_limite integer)
returns table(linha_id uuid,descricao text,classificacao_id uuid,tipo text,autor_id uuid,decisao text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from comercial.sso_classificacao_linha_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_proposta_id is null or p_versao is null or (config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true and config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 if not exists(select 1 from comercial.proposta_origens_operacionais o join pcm.ordens_servico os on os.id=o.ordem_servico_id and os.client_id=p_cliente_id and os.deleted_at is null where o.proposta_id=p_proposta_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select (e->>'id')::uuid,e->>'descricao',c.id,c.tipo,c.ator_id,r.decisao from comercial.sso_itens_publicos_proposta s cross join lateral jsonb_array_elements(s.itens) e
 left join comercial.sso_classificacoes_linha c on c.proposta_id=s.proposta_id and c.versao=s.versao and c.linha_id=(e->>'id')::uuid and c.cliente_id=p_cliente_id
 left join comercial.sso_revisoes_classificacao_linha r on r.classificacao_id=c.id
 where s.proposta_id=p_proposta_id and s.versao=p_versao and (p_apos is null or (e->>'id')::uuid>p_apos) order by (e->>'id')::uuid limit p_limite;
end $$;
revoke all on function comercial.sso_listar_classificacao_linhas(uuid,uuid,integer,uuid,integer) from public,anon,authenticated,service_role;
