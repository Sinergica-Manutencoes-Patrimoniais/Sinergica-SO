-- ADR-1166: leitura de estado e fence para cancelamento local, gate fechado.
create function pcm.sso_t24_prever_cancelamento(p_cliente_id uuid,p_visita_id uuid,p_os_id uuid,p_tentativa_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare t pcm.sso_t24_tentativas%rowtype;
begin
 if auth.uid() is null or p_cliente_id is null or p_visita_id is null or p_os_id is null or p_tentativa_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_t24_cancelamento_gate where id and habilitado for share;
 if not found then raise exception 'cancelamento_desabilitado' using errcode='55000'; end if;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into t from pcm.sso_t24_tentativas where id=p_tentativa_id and cliente_id=p_cliente_id and visita_id=p_visita_id and os_id=p_os_id;
 if not found then raise exception 'tentativa_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.visitas where id=t.visita_id and cliente_id=p_cliente_id for share nowait;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.ordens_servico where id=t.os_id and client_id=p_cliente_id and deleted_at is null for share nowait;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('tentativaId',t.id,'visitaId',t.visita_id,'osId',t.os_id,'estado',t.estado,'fence',t.fence,'efeitoRemotoComprovado',false);
end; $$;
revoke all on function pcm.sso_t24_prever_cancelamento(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_t24_prever_cancelamento(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function pcm.sso_t24_cancelar_candidata(uuid,uuid,uuid,bigint,text) to authenticated;
