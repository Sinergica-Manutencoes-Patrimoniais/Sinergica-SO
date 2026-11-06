-- ADR-1130: histórico local, sem dados de payload ou efeito remoto.
create function pcm.sso_listar_historico_demora(p_ator_id uuid,p_cliente_id uuid,p_outbox_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,estado text,iniciado_em timestamptz,limite_minutos integer,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
declare v_obs pcm.sso_demora_fila_observacoes%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_outbox_id is null or p_apos is null or p_apos<0
  or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 perform 1 from pcm.sso_observacao_fila_gate where id and habilitado for share;
 if not found then raise exception 'observacao_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select d.* into v_obs from pcm.sso_demora_fila_observacoes d join pcm.auvo_sync_outbox q on q.id=d.outbox_id and q.entity=d.entidade and q.row_id=d.objeto_id
  where d.outbox_id=p_outbox_id and d.cliente_id=p_cliente_id for share of d,q;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if v_obs.entidade='sistemas' then perform 1 from pcm.sistemas where id=v_obs.objeto_id and cliente_id=p_cliente_id for share;
 elsif v_obs.entidade='equipamentos' then perform 1 from pcm.equipamentos where id=v_obs.objeto_id and client_id=p_cliente_id for share;
 else raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if not found or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 return query select e.revisao,e.estado,e.iniciado_em,e.limite_minutos,e.criado_em from pcm.sso_demora_fila_eventos e
  where e.outbox_id=p_outbox_id and e.cliente_id=p_cliente_id and e.revisao>p_apos order by e.revisao limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_historico_demora(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_historico_demora(uuid,uuid,uuid,integer,integer) to authenticated;
