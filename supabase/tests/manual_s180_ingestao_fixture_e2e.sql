-- Somente cluster isolado descartável; fixtures permanecem nele até destruição.
\set ON_ERROR_STOP on
begin;
set local app.auvo_sync_write='true';
\ir E01-S168_finalizacao_fixture_real.sql
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16891000-0000-4000-8000-000000000001','despesa_visita.gerir','16891000-0000-4000-8000-000000000002');
insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,created_by) values ('16891000-0000-4000-8000-000000000052','16891000-0000-4000-8000-000000000002','2026-11-01 11:00+00','2026-11-01 13:00+00','America/Sao_Paulo','regular','16891000-0000-4000-8000-000000000001');
insert into pcm.despesa_tipos(id,auvo_id,nome) values ('16891000-0000-4000-8000-000000000053',-16891001,'E2E sintético');
insert into pcm.despesas_visita(id,visita_id,cliente_id,categoria_id,data,descricao,previsto_centavos,created_by) values ('16891000-0000-4000-8000-000000000054','16891000-0000-4000-8000-000000000052','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000053','2026-11-01','E2E sintético',100,'16891000-0000-4000-8000-000000000001');
update pcm.sso_ingestao_comprovante_gate set habilitado=true where id;
update pcm.sso_upload_comprovante_gate set habilitado=true where id;
commit;
