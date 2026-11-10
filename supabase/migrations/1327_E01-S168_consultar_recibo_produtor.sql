-- ADR-1160: consulta somente recibo; não cria candidata nem autoriza rede.
create function pcm.sso_t24_consultar_recibo_produtor(p_request_id uuid,p_cliente_id uuid,p_visita_id uuid,p_os_id uuid,p_revisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r pcm.sso_t24_produtor_recibos%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_visita_id is null or p_os_id is null or p_revisao is null or p_revisao<1 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_t24_produtor_gate where id and habilitado for share;
 if not found then raise exception 'produtor_desabilitado' using errcode='55000'; end if;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into r from pcm.sso_t24_produtor_recibos where request_id=p_request_id and ator_id=auth.uid() and cliente_id=p_cliente_id
  and visita_id=p_visita_id and os_id=p_os_id and revisao=p_revisao;
 if not found then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return r.resultado;
end; $$;
revoke all on function pcm.sso_t24_consultar_recibo_produtor(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_t24_consultar_recibo_produtor(uuid,uuid,uuid,uuid,integer) to authenticated;
