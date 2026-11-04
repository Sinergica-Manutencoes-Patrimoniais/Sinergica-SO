-- ADR-0833. Preparação privada; não altera policies, grants existentes ou gates.
create function pcm.sso_s180_dispatch_autorizacao_privada(p_bucket text, p_nome text, p_owner text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then return false; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)
  ) then return false; end if;
  return pcm.sso_s180_dispatch_storage_experimental(p_bucket, p_nome, p_owner);
end $$;

revoke all on function pcm.sso_s180_dispatch_autorizacao_privada(text,text,text)
  from public, anon, authenticated, service_role;
comment on function pcm.sso_s180_dispatch_autorizacao_privada(text,text,text) is
  'Preparação privada desconectada. Não protege outras fontes e não autoriza rollout.';
