-- ADR-1111: consulta de relações declaradas, sem efeito financeiro.
create function comercial.sso_listar_correlacoes_gasto(p_ator_id uuid,p_cliente_id uuid,p_lista_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,fonte_id uuid,despesa_id uuid,vinculo_id uuid,despesa_revisao integer,rateio_revisao integer,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_lista_id is null or p_limite is null or p_limite not between 1 and 100
   then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_correlacao_gasto_gate where id and habilitado for share;
 if not found then raise exception 'correlacao_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.listas_materiais l join pcm.ordens_servico os on os.id=l.ordem_servico_id and os.client_id=l.cliente_id and os.deleted_at is null
   where l.id=p_lista_id and l.cliente_id=p_cliente_id for share of l,os;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select c.request_id,c.fonte_id,c.despesa_id,c.vinculo_id,c.despesa_revisao,c.rateio_revisao,c.criado_em
  from comercial.sso_correlacoes_gasto c join comercial.sso_fontes_custo_aquisicao f on f.id=c.fonte_id and f.cliente_id=c.cliente_id
  join pcm.despesas_visita d on d.id=c.despesa_id and d.cliente_id=c.cliente_id
  where c.cliente_id=p_cliente_id and f.lista_id=p_lista_id and (p_apos is null or c.request_id>p_apos)
  order by c.request_id limit p_limite;
end; $$;
revoke all on function comercial.sso_listar_correlacoes_gasto(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
