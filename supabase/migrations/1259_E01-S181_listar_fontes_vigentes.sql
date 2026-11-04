-- ADR-1107: lista corrente exclui fontes substituídas, sem apagá-las.
create or replace function comercial.sso_listar_fontes_aquisicao(p_ator_id uuid,p_cliente_id uuid,p_lista_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,lista_revisao integer,tipo text,descricao text,valor_centavos bigint,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_lista_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_fonte_aquisicao_gate where id and habilitado for share;
 if not found then raise exception 'fonte_aquisicao_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.listas_materiais l join pcm.ordens_servico os on os.id=l.ordem_servico_id and os.client_id=l.cliente_id and os.deleted_at is null
   where l.id=p_lista_id and l.cliente_id=p_cliente_id and l.responsavel='sinergica' for share of l,os;
 if not found then raise exception 'lista_indisponivel' using errcode='42501'; end if;
 return query select f.id,f.lista_revisao,f.tipo,f.descricao,f.valor_centavos,f.criado_em
   from comercial.sso_fontes_custo_aquisicao f where f.cliente_id=p_cliente_id and f.lista_id=p_lista_id and not exists(select 1 from comercial.sso_retificacoes_fonte_aquisicao r where r.fonte_anterior_id=f.id) and (p_apos is null or f.id>p_apos) order by f.id limit p_limite;
end; $$;
