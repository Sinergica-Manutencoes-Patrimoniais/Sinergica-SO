-- ADR-1221: apenas versões públicas, sem conceder acesso aos núcleos.
create function comercial.sso_exigir_historico_proposta_portal(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null or p_proposta_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from comercial.sso_exportacao_operacional_gate where id and habilitado for share;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id
    where uc.user_id=p_ator_id and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico' for share of uc,u;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null for share;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from comercial.propostas where id=p_proposta_id and deleted_at is null for share;
  if not found or comercial.sso_portal_origem_operacional_autorizada(p_cliente_id,p_os_id,p_proposta_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function comercial.sso_exigir_historico_proposta_portal(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function comercial.sso_portal_historico_operacional_mediado(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid,p_apos integer)
returns table(versao integer,publicado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
  if p_apos is null or p_apos<0 then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform comercial.sso_exigir_historico_proposta_portal(p_ator_id,p_cliente_id,p_os_id,p_proposta_id);
  return query select * from comercial.sso_portal_historico_operacional(p_cliente_id,p_os_id,p_proposta_id,p_apos);
end; $$;
revoke all on function comercial.sso_portal_historico_operacional_mediado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_portal_historico_operacional_mediado(uuid,uuid,uuid,uuid,integer) to authenticated;

create function comercial.sso_portal_versao_operacional_mediada(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid,p_versao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if p_versao is null or p_versao<1 then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform comercial.sso_exigir_historico_proposta_portal(p_ator_id,p_cliente_id,p_os_id,p_proposta_id);
  return comercial.sso_portal_versao_operacional(p_cliente_id,p_os_id,p_proposta_id,p_versao);
end; $$;
revoke all on function comercial.sso_portal_versao_operacional_mediada(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_portal_versao_operacional_mediada(uuid,uuid,uuid,uuid,integer) to authenticated;
