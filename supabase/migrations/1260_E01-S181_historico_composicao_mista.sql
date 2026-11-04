-- ADR-1108: leitura privada das fontes de uma versão; não altera valores.
create function comercial.sso_listar_fontes_composicao_mista(p_ator_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_versao integer,p_apos uuid,p_limite integer)
returns table(request_id uuid,fontes_operacionais jsonb,fontes_aquisicao jsonb,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_proposta_id is null
   or p_versao is null or p_versao<1 or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_composicao_mista_gate where id and habilitado for share;
 if not found then raise exception 'composicao_mista_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from comercial.propostas p join comercial.proposta_origens_operacionais origem on origem.proposta_id=p.id
   join pcm.listas_materiais l on l.id=origem.lista_materiais_id and l.cliente_id=p_cliente_id
   join pcm.ordens_servico os on os.id=origem.ordem_servico_id and os.id=l.ordem_servico_id and os.client_id=p_cliente_id and os.deleted_at is null
   left join comercial.oportunidades op on op.id=p.oportunidade_id
   where p.id=p_proposta_id and p.deleted_at is null and (p.oportunidade_id is null or op.cliente_id=p_cliente_id) for share of p,l,os;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select c.request_id,c.fontes_validadas,c.aquisicoes_validadas,c.criado_em
 from comercial.sso_composicao_mista_comandos c where c.cliente_id=p_cliente_id and c.payload->>'propostaId'=p_proposta_id::text
   and c.resultado->>'revision'=p_versao::text and (p_apos is null or c.request_id>p_apos) order by c.request_id limit p_limite;
end; $$;
revoke all on function comercial.sso_listar_fontes_composicao_mista(uuid,uuid,uuid,integer,uuid,integer) from public,anon,authenticated,service_role;
