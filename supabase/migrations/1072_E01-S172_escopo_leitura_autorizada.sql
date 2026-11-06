-- ADR-0887: leitura protegida, sem alterar a declaração ou a OS.
create function pcm.sso_consultar_escopo_autorizado(p_cliente_id uuid,p_os_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  perform 1 from pcm.sso_escopo_origem_gate where id for share;
  perform 1 from pcm.sso_origem_execucao_unificada_gate where id for share;
  return pcm.sso_consultar_escopo_origem(p_cliente_id,p_os_id);
end; $$;
revoke all on function pcm.sso_consultar_escopo_autorizado(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_escopo_autorizado(uuid,uuid) to authenticated;
revoke execute on function pcm.sso_consultar_escopo_origem(uuid,uuid) from public,anon,authenticated,service_role;
