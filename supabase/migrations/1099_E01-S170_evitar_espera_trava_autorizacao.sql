-- ADR-0946: não aguardar a trava global mantendo outras travas de escrita.
create or replace function config.sso_serializar_fonte_autorizacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  return null;
end;
$$;
revoke all on function config.sso_serializar_fonte_autorizacao() from public, anon, authenticated, service_role;
