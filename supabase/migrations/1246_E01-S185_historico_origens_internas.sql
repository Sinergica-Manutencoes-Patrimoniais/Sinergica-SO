-- ADR-1097: histórico mínimo, sempre condicionado ao proprietário atual.
create function pcm.sso_historico_observacao_origem(p_ator_id uuid,p_cliente_id uuid,p_tipo text,p_objeto_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,estado_fonte text,classificacao text,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_tipo is null or p_tipo not in ('comercial','financeiro')
   or p_objeto_id is null or p_apos is null or p_apos<0 or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_varredura_origens_gate where id and habilitado for share;
 if not found then raise exception 'observacao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_tipo='comercial' then
   if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
   perform 1 from comercial.proposta_origens_operacionais origem
     join comercial.propostas p on p.id=origem.proposta_id and p.deleted_at is null
     left join comercial.oportunidades op on op.id=p.oportunidade_id
     join pcm.ordens_servico os on os.id=origem.ordem_servico_id and os.client_id=p_cliente_id and os.deleted_at is null
     join pcm.listas_materiais l on l.id=origem.lista_materiais_id and l.cliente_id=p_cliente_id
     where p.id=p_objeto_id and (p.oportunidade_id is null or op.cliente_id=p_cliente_id) for share of p,os,l;
 else
   if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
     or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
   perform 1 from financeiro.itens_faturaveis f
     left join financeiro.sso_declaracoes_repasse_despesa r on r.item_id=f.id
     where f.id=p_objeto_id and f.cliente_id=p_cliente_id and (f.origem_tipo='despesa_visita' or r.item_id is not null) for share of f;
 end if;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if exists(select 1 from pcm.sso_observacoes_origens_internas o where o.tipo=p_tipo and o.objeto_id=p_objeto_id and o.cliente_id<>p_cliente_id)
   then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true
   or (p_tipo='comercial' and config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true)
   or (p_tipo='financeiro' and (config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
     or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true)) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select e.revisao,e.estado_fonte,e.classificacao,e.criado_em
   from pcm.sso_observacoes_origens_eventos e join pcm.sso_observacoes_origens_internas o on o.tipo=e.tipo and o.objeto_id=e.objeto_id
   where o.cliente_id=p_cliente_id and e.tipo=p_tipo and e.objeto_id=p_objeto_id and e.revisao>p_apos order by e.revisao limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_observacao_origem(uuid,uuid,text,uuid,integer,integer) from public,anon,authenticated,service_role;
