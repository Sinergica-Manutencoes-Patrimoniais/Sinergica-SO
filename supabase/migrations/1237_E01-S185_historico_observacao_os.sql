-- ADR-1086: histórico local, sem tarefa remota ou payload.
create function pcm.sso_listar_observacoes_os(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,estado_local text,sincronizacao text,possui_tarefa boolean,fonte_atualizada_em timestamptz,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null
   or p_apos is null or p_apos<0 or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_observacao_os_gate where id and habilitado for share;
 if not found then raise exception 'observacao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if exists(select 1 from pcm.sso_observacoes_os o where o.os_id=p_os_id and o.cliente_id<>p_cliente_id)
   then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select e.revisao,e.estado_local,e.sincronizacao,e.possui_tarefa,e.fonte_atualizada_em,e.criado_em
  from pcm.sso_observacoes_os_eventos e join pcm.sso_observacoes_os o on o.os_id=e.os_id
  where o.os_id=p_os_id and o.cliente_id=p_cliente_id and e.revisao>p_apos order by e.revisao limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_observacoes_os(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
