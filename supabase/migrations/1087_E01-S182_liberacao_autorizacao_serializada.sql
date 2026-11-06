-- ADR-0922. Não abre gates nem modifica eventos existentes.
create function financeiro.sso_validar_autorizacao_liberacao_reserva()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  select cliente_id into v_cliente from financeiro.sso_documentos_internos where id = new.documento_interno_id;
  if auth.uid() is null or v_cliente is null or config.sso_autorizar_acao('faturavel.efetivar', v_cliente) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function financeiro.sso_validar_autorizacao_liberacao_reserva() from public, anon, authenticated, service_role;
create trigger sso_autorizar_liberacao_reserva before insert on financeiro.sso_documentos_internos_liberacoes
for each row execute function financeiro.sso_validar_autorizacao_liberacao_reserva();
