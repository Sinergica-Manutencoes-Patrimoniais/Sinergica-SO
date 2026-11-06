-- ADR-1329: preserva INSERT e protege histórico inclusive contra service_role.
revoke update, delete, truncate on audit.events from public, anon, authenticated, service_role;

create function audit.sso_proteger_eventos_imutaveis()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'historico_auditoria_imutavel' using errcode='42501';
end; $$;
revoke all on function audit.sso_proteger_eventos_imutaveis() from public,anon,authenticated,service_role;
create trigger sso_proteger_eventos_imutaveis
before update or delete or truncate on audit.events
for each statement execute function audit.sso_proteger_eventos_imutaveis();
