-- ADR-1094: consulta local; tempo não é lease ou autorização de retry.
create function pcm.sso_consultar_inicio_processamento(p_ator_id uuid,p_cliente_id uuid,p_outbox_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_fila pcm.auvo_sync_outbox%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_outbox_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_fila from pcm.auvo_sync_outbox where id=p_outbox_id for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if v_fila.entity='sistemas' then
   perform 1 from pcm.sistemas where id=v_fila.row_id and cliente_id=p_cliente_id for share;
 elsif v_fila.entity='equipamentos' then
   perform 1 from pcm.equipamentos where id=v_fila.row_id and client_id=p_cliente_id for share;
 else raise exception 'origem_indisponivel' using errcode='42501';
 end if;
 if not found or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 return jsonb_build_object('outboxId',p_outbox_id,'estadoFila',v_fila.status,
   'processamentoIniciadoEm',case when v_fila.status='processing' then v_fila.processamento_iniciado_em else null end,
   'observadoEm',now(),'estadoRemoto','desconhecido','autorizaRetry',false);
end; $$;
revoke all on function pcm.sso_consultar_inicio_processamento(uuid,uuid,uuid) from public,anon,authenticated,service_role;
