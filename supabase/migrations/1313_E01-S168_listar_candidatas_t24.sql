-- ADR-1144: leitura restrita; gates seguem fechados e não há escrita ou rede.
create function pcm.sso_t24_listar_candidatas(p_ator_id uuid,p_cliente_id uuid,p_visita_id uuid,p_os_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,revisao integer,estado text,elegivel_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_visita_id is null or p_os_id is null
  or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_t24_diagnostico_gate where id and habilitado for share;
 if not found then raise exception 'diagnostico_desabilitado' using errcode='55000'; end if;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.visitas where id=p_visita_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null for share;
 if not found or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 return query select t.id,t.revisao_visita,t.estado,t.elegivel_em from pcm.sso_t24_tentativas t
  where t.cliente_id=p_cliente_id and t.visita_id=p_visita_id and t.os_id=p_os_id and (p_apos is null or t.id>p_apos) order by t.id limit p_limite;
end; $$;
revoke all on function pcm.sso_t24_listar_candidatas(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_t24_listar_candidatas(uuid,uuid,uuid,uuid,uuid,integer) to authenticated;
grant execute on function pcm.sso_t24_diagnosticar_candidata(uuid,uuid,uuid) to authenticated;
