-- Fixture apenas sintética. Executar em banco novo sso_s182_descartavel.
\set ON_ERROR_STOP on
\ir manual_s182_reserva_trigger_fixture.sql
create schema audit;
create table audit.events(actor_id uuid, action text, entity text, entity_id uuid, payload jsonb);
create table config.autorizacao_teste(habilitada boolean not null);
insert into config.autorizacao_teste values (true);
create or replace function config.sso_autorizar_acao(text,uuid) returns boolean language sql stable as $$ select habilitada from config.autorizacao_teste $$;
alter table financeiro.itens_faturaveis add column origem_tipo text, add column origem_id uuid, add column competencia date, add column valor_conferido_centavos bigint;
alter table financeiro.sso_selecoes_documento add column origem_tipo text, add column origem_id uuid, add column competencia date, add column ator_id uuid;
alter table financeiro.sso_documentos_internos add column origem_tipo text, add column origem_id uuid, add column competencia date, add column ator_id uuid;
create table financeiro.fechamentos_mensais(competencia date, status text);
create table financeiro.sso_faturavel_alocacoes(id uuid);
create table financeiro.sso_faturavel_documentos(id uuid);
create table financeiro.sso_faturavel_comandos(request_id uuid);
create table financeiro.lancamentos(id uuid);
create function financeiro.sso_totais_alocacoes_ativas(uuid,uuid) returns jsonb language sql as $$ select '{"itemCentavos":0,"documentoCentavos":0}'::jsonb $$;
\ir ../migrations/0751_E01-S182_consumidores_saldo_canonico.sql
insert into financeiro.sso_selecao_documento_gate values (true,true);
insert into financeiro.sso_documento_interno_gate values (true,true);
update financeiro.itens_faturaveis set cliente_id='18290000-0000-4000-8000-000000000002',revisao=1,status='conferido',origem_tipo='teste',origem_id='18290000-0000-4000-8000-000000000040',competencia='2026-11-01',valor_conferido_centavos=10000 where id='18290000-0000-4000-8000-000000000031';
select financeiro.sso_selecionar_faturavel_documento('18290000-0000-4000-8000-000000000041','18290000-0000-4000-8000-000000000031',1);
select financeiro.sso_selecionar_faturavel_documento('18290000-0000-4000-8000-000000000042','18290000-0000-4000-8000-000000000031',1);
