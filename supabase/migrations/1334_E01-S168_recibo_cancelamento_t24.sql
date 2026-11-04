-- ADR-1167: somente consulta; não altera fila, candidata ou tarefa externa.
create function pcm.sso_t24_consultar_cancelamento(p_request_id uuid,p_cliente_id uuid,p_visita_id uuid,p_os_id uuid,p_tentativa_id uuid,p_fence bigint,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r pcm.sso_t24_cancelamento_recibos%rowtype;v_payload jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_visita_id is null or p_os_id is null or p_tentativa_id is null or p_fence is null or p_fence<0
  or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_t24_cancelamento_gate where id and habilitado for share;
 if not found or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'tentativaId',p_tentativa_id,'fence',p_fence,'motivo',btrim(p_motivo));
 select * into r from pcm.sso_t24_cancelamento_recibos where request_id=p_request_id and ator_id=auth.uid() and cliente_id=p_cliente_id and tentativa_id=p_tentativa_id and payload=v_payload;
 if not found then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.sso_t24_tentativas t join pcm.visitas v on v.id=t.visita_id and v.cliente_id=p_cliente_id
  join pcm.ordens_servico o on o.id=t.os_id and o.client_id=p_cliente_id and o.deleted_at is null
  where t.id=p_tentativa_id and t.cliente_id=p_cliente_id and t.visita_id=p_visita_id and t.os_id=p_os_id for share of v,o nowait;
 if not found or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
 return r.resultado;
end; $$;
revoke all on function pcm.sso_t24_consultar_cancelamento(uuid,uuid,uuid,uuid,uuid,bigint,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_t24_consultar_cancelamento(uuid,uuid,uuid,uuid,uuid,bigint,text) to authenticated;
