-- Executar apenas após fixtures sintéticas e migration 1086 em banco descartável.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'sso_s182_descartavel' then raise exception 'banco não descartável'; end if; end $$;
begin;
update config.sso_concessoes set ativa=true where acao='faturavel.efetivar';
insert into financeiro.itens_faturaveis(id,cliente_id,revisao,status,origem_tipo,origem_id,competencia,valor_conferido_centavos)
values('18290000-0000-4000-8000-000000000039','18290000-0000-4000-8000-000000000002',1,'conferido','teste','18290000-0000-4000-8000-000000000072','2026-11-01',10000);
select financeiro.sso_selecionar_faturavel_documento('18290000-0000-4000-8000-000000000073','18290000-0000-4000-8000-000000000039',1);
do $$ declare r jsonb; begin
  r := financeiro.sso_emitir_documento_interno_parcial('18290000-0000-4000-8000-000000000074','18290000-0000-4000-8000-000000000073',6000);
  if r->>'valorReservadoCentavos' <> '6000' then raise exception 'reserva autorizada falhou'; end if;
  r := financeiro.sso_emitir_documento_interno_parcial('18290000-0000-4000-8000-000000000074','18290000-0000-4000-8000-000000000073',6000);
  if r->>'documentoInternoId' <> '18290000-0000-4000-8000-000000000074' then raise exception 'replay divergente'; end if;
  if has_function_privilege('authenticated','financeiro.sso_validar_autorizacao_reserva_interna()','execute') or has_function_privilege('anon','financeiro.sso_validar_autorizacao_reserva_interna()','execute') or has_function_privilege('service_role','financeiro.sso_validar_autorizacao_reserva_interna()','execute') then raise exception 'execução direta indevida'; end if;
end $$;
update config.sso_concessoes set ativa=false where acao='faturavel.efetivar';
do $$ begin
  begin
    insert into financeiro.sso_documentos_internos(id,item_id,selecao_id,cliente_id) values('18290000-0000-4000-8000-000000000075','18290000-0000-4000-8000-000000000039','18290000-0000-4000-8000-000000000076','18290000-0000-4000-8000-000000000002');
    raise exception 'reserva sem autorização aceita';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
