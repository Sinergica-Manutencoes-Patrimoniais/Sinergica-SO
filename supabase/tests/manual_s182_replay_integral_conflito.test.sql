-- Somente banco descartável após manual_s182_replay_emissao_fixture.sql.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'sso_s182_descartavel' then raise exception 'banco não descartável'; end if; end $$;
begin;
update config.sso_concessoes set ativa=true where acao='faturavel.efetivar';
insert into financeiro.itens_faturaveis(id,cliente_id,revisao,status,origem_tipo,origem_id,competencia,valor_conferido_centavos)
values('18290000-0000-4000-8000-000000000130','18290000-0000-4000-8000-000000000002',1,'conferido','teste','18290000-0000-4000-8000-000000000131','2026-11-01',10000);
select financeiro.sso_selecionar_faturavel_documento('18290000-0000-4000-8000-000000000132','18290000-0000-4000-8000-000000000130',1);
do $$ declare primeiro jsonb; repetido jsonb; begin
  primeiro := financeiro.sso_emitir_documento_interno('18290000-0000-4000-8000-000000000133','18290000-0000-4000-8000-000000000132');
  repetido := financeiro.sso_emitir_documento_interno('18290000-0000-4000-8000-000000000133','18290000-0000-4000-8000-000000000132');
  if primeiro is distinct from repetido or repetido->>'valorReservadoCentavos' <> '10000' then raise exception 'replay integral válido divergente'; end if;
end $$;
do $$ begin
  begin
    perform financeiro.sso_emitir_documento_interno('18290000-0000-4000-8000-000000000114','18290000-0000-4000-8000-000000000113');
    raise exception 'emissão integral aceitou reserva parcial anterior';
  exception when unique_violation then null; end;
end $$;
rollback;
