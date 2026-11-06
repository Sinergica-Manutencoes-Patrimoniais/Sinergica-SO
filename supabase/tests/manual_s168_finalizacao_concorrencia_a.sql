-- Exclusivamente banco descartável com setup. Aviso marca transição antes do COMMIT.
\set ON_ERROR_STOP on
begin;
set local app.auvo_sync_write='true';
set local request.jwt.claims = '{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select pcm.sso_finalizar_os_validada_v2('16891000-0000-4000-8000-000000000035','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000017','16891000-0000-4000-8000-000000000034',1,'em_execucao','2026-10-01T10:00:00Z');
\echo A_FINALIZACAO_SEM_COMMIT
select pg_sleep(8);
commit;
