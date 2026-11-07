-- ADR-1103: não expõe Cliente anterior nem altera conflito.
create or replace function pcm.sso_listar_conflitos_propriedade_os(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(os_id uuid,numero text,revisao integer,situacao text,observado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_limite is null or p_limite not between 1 and 100
   then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_observacao_os_gate where id and habilitado for share;
 if not found then raise exception 'observacao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select os.id,os.numero::text,c.revisao,
   case when c.cliente_observacao_id=os.client_id and exists(select 1 from pcm.sso_confirmacoes_retorno_propriedade_os d
     where d.os_id=os.id and d.cliente_id=p_cliente_id and d.conflito_revisao=c.revisao and coalesce(os.updated_at,os.created_at)<=d.criado_em)
     then 'retorno_confirmado' when c.cliente_observacao_id=os.client_id then 'retorno_observado_conferir' else 'divergencia_observada' end::text,c.atualizado_em
 from pcm.sso_conflitos_propriedade_os c join pcm.ordens_servico os on os.id=c.os_id and os.client_id=p_cliente_id and os.deleted_at is null
 where p_apos is null or os.id>p_apos order by os.id limit p_limite;
end; $$;
