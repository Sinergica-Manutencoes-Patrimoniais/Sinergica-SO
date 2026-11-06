-- Somente em banco descartável após fixtures S182 e migration 1087.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'sso_s182_descartavel' then raise exception 'banco não descartável'; end if; end $$;
begin;
update config.sso_concessoes set ativa=true where acao='faturavel.efetivar';
do $$ declare r jsonb; begin
  r:=financeiro.sso_liberar_reserva_interna('18290000-0000-4000-8000-000000000083','18290000-0000-4000-8000-000000000055',1,'Motivo teste');
  if r->>'estado'<>'reserva_liberada' then raise exception 'liberação autorizada falhou'; end if;
  r:=financeiro.sso_liberar_reserva_interna('18290000-0000-4000-8000-000000000083','18290000-0000-4000-8000-000000000055',1,'Motivo teste');
  if r->>'requestId'<>'18290000-0000-4000-8000-000000000083' then raise exception 'replay divergente'; end if;
  if has_function_privilege('authenticated','financeiro.sso_validar_autorizacao_liberacao_reserva()','execute') or has_function_privilege('anon','financeiro.sso_validar_autorizacao_liberacao_reserva()','execute') or has_function_privilege('service_role','financeiro.sso_validar_autorizacao_liberacao_reserva()','execute') then raise exception 'execução direta indevida'; end if;
end $$;
update config.sso_concessoes set ativa=false where acao='faturavel.efetivar';
do $$ begin
  begin
    insert into financeiro.sso_documentos_internos_liberacoes(request_id,documento_interno_id,acao) values('18290000-0000-4000-8000-000000000084','18290000-0000-4000-8000-000000000057','liberar');
    raise exception 'liberação sem autorização aceita';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
