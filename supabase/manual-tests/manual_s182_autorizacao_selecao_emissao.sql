-- Somente banco descartável, após as fixtures de replay e a migration 1089.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'sso_s182_descartavel' then raise exception 'banco não descartável'; end if; end $$;
begin;
update config.sso_concessoes set ativa=true where acao='faturavel.efetivar';
do $$ declare r jsonb; begin
  r := financeiro.sso_selecionar_faturavel_documento('18290000-0000-4000-8000-000000000113','18290000-0000-4000-8000-000000000110',1);
  if r->>'itemId' <> '18290000-0000-4000-8000-000000000110' then raise exception 'replay da seleção divergente'; end if;
  r := financeiro.sso_emitir_documento_interno_parcial('18290000-0000-4000-8000-000000000114','18290000-0000-4000-8000-000000000113',6000);
  if r->>'valorReservadoCentavos' <> '6000' then raise exception 'replay da emissão divergente'; end if;
  begin
    perform financeiro.sso_emitir_documento_interno_parcial('18290000-0000-4000-8000-000000000114','18290000-0000-4000-8000-000000000113',5000);
    raise exception 'replay conflitante aceito';
  exception when unique_violation then null; end;
end $$;
update config.sso_concessoes set ativa=false where acao='faturavel.efetivar';
do $$ begin
  begin
    perform financeiro.sso_selecionar_faturavel_documento('18290000-0000-4000-8000-000000000113','18290000-0000-4000-8000-000000000110',1);
    raise exception 'seleção após revogação aceita';
  exception when insufficient_privilege then null; end;
  begin
    perform financeiro.sso_emitir_documento_interno_parcial('18290000-0000-4000-8000-000000000114','18290000-0000-4000-8000-000000000113',6000);
    raise exception 'emissão parcial após revogação aceita';
  exception when insufficient_privilege then null; end;
  begin
    perform financeiro.sso_emitir_documento_interno('18290000-0000-4000-8000-000000000114','18290000-0000-4000-8000-000000000113');
    raise exception 'emissão integral após revogação aceita';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
