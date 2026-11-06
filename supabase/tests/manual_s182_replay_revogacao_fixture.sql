-- Apenas banco descartável com fixtures de conversão já carregadas; não usar em dados oficiais.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'sso_s182_descartavel' then raise exception 'banco não descartável'; end if; end $$;
update config.sso_concessoes set ativa=true where acao='faturavel.efetivar';
insert into financeiro.itens_faturaveis(id,cliente_id,revisao,status,origem_tipo,origem_id,competencia,valor_conferido_centavos)
values('18290000-0000-4000-8000-000000000110','18290000-0000-4000-8000-000000000002',1,'conferido','teste','18290000-0000-4000-8000-000000000111','2026-11-01',10000);
insert into financeiro.lancamentos(id,tipo,cliente_id,data_competencia,valor_centavos) values('18290000-0000-4000-8000-000000000112','entrada','18290000-0000-4000-8000-000000000002','2026-11-01',10000);
select financeiro.sso_selecionar_faturavel_documento('18290000-0000-4000-8000-000000000113','18290000-0000-4000-8000-000000000110',1);
select financeiro.sso_emitir_documento_interno_parcial('18290000-0000-4000-8000-000000000114','18290000-0000-4000-8000-000000000113',6000);
select financeiro.sso_converter_reserva_interna('18290000-0000-4000-8000-000000000115','18290000-0000-4000-8000-000000000114',1,'18290000-0000-4000-8000-000000000116','18290000-0000-4000-8000-000000000112','DOC-C','2026-11-01','Motivo');
-- View/barreira só na fixture: interrompe leitura do comando após autorização da alocação.
alter table financeiro.sso_faturavel_comandos rename to sso_faturavel_comandos_teste_base;
create function financeiro.sso_teste_aguardar_comando(uuid) returns boolean language plpgsql volatile as $$
begin perform pg_advisory_xact_lock(182,2); return true; end $$;
create view financeiro.sso_faturavel_comandos as select request_id,ator_id,payload,resultado from financeiro.sso_faturavel_comandos_teste_base where financeiro.sso_teste_aguardar_comando(request_id);
