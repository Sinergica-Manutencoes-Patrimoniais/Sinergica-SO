-- RPCs 0737/0751 reais com tabelas, autorização e totais simulados; rollback integral.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'sso_s182_descartavel' then raise exception 'banco não descartável'; end if; end $$;
begin;
update config.sso_concessoes set ativa=true where acao='faturavel.efetivar';
insert into financeiro.itens_faturaveis(id,cliente_id,revisao,status,origem_tipo,origem_id,competencia,valor_conferido_centavos) values
('18290000-0000-4000-8000-000000000090','18290000-0000-4000-8000-000000000002',1,'conferido','teste','18290000-0000-4000-8000-000000000091','2026-11-01',10000),
('18290000-0000-4000-8000-000000000092','18290000-0000-4000-8000-000000000002',1,'conferido','teste','18290000-0000-4000-8000-000000000093','2026-11-01',10000);
insert into financeiro.lancamentos(id,tipo,cliente_id,data_competencia,valor_centavos) values
('18290000-0000-4000-8000-000000000094','entrada','18290000-0000-4000-8000-000000000002','2026-11-01',10000),
('18290000-0000-4000-8000-000000000095','entrada','18290000-0000-4000-8000-000000000099','2026-11-01',10000);
select financeiro.sso_selecionar_faturavel_documento('18290000-0000-4000-8000-000000000096','18290000-0000-4000-8000-000000000090',1);
select financeiro.sso_selecionar_faturavel_documento('18290000-0000-4000-8000-000000000097','18290000-0000-4000-8000-000000000092',1);
select financeiro.sso_emitir_documento_interno_parcial('18290000-0000-4000-8000-000000000098','18290000-0000-4000-8000-000000000096',6000);
select financeiro.sso_emitir_documento_interno_parcial('18290000-0000-4000-8000-000000000100','18290000-0000-4000-8000-000000000097',6000);
do $$ declare primeiro jsonb; segundo jsonb; begin
  primeiro:=financeiro.sso_converter_reserva_interna('18290000-0000-4000-8000-000000000101','18290000-0000-4000-8000-000000000098',1,'18290000-0000-4000-8000-000000000102','18290000-0000-4000-8000-000000000094','DOC-A','2026-11-01','Motivo');
  segundo:=financeiro.sso_converter_reserva_interna('18290000-0000-4000-8000-000000000101','18290000-0000-4000-8000-000000000098',1,'18290000-0000-4000-8000-000000000102','18290000-0000-4000-8000-000000000094','DOC-A','2026-11-01','Motivo');
  if primeiro is distinct from segundo or (select count(*) from financeiro.sso_faturavel_alocacoes where request_id='18290000-0000-4000-8000-000000000101')<>1 then raise exception 'replay duplicou ou divergiu'; end if;
  begin
    perform financeiro.sso_converter_reserva_interna('18290000-0000-4000-8000-000000000103','18290000-0000-4000-8000-000000000100',1,'18290000-0000-4000-8000-000000000104','18290000-0000-4000-8000-000000000095','DOC-B','2026-11-01','Motivo');
    raise exception 'Cliente diferente aceito';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from financeiro.sso_documentos_internos_liberacoes where request_id='18290000-0000-4000-8000-000000000103') then raise exception 'falha deixou liberação parcial'; end if;
end $$;
rollback;
