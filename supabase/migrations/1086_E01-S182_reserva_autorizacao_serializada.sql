-- ADR-0921. Nenhum gate é aberto; registros existentes não são alterados.
create function financeiro.sso_validar_autorizacao_reserva_interna()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  if auth.uid() is null or config.sso_autorizar_acao('faturavel.efetivar', new.cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function financeiro.sso_validar_autorizacao_reserva_interna() from public, anon, authenticated, service_role;
create trigger sso_autorizar_reserva_interna before insert on financeiro.sso_documentos_internos
for each row execute function financeiro.sso_validar_autorizacao_reserva_interna();
