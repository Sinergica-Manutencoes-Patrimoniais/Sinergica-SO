-- SOMENTE banco descartável com manual_s173_concorrencia_fixture.sql aplicado.
-- Rode A primeiro; ao aparecer A_RETORNO_INSERIDO, execute B imediatamente.
\set ON_ERROR_STOP on
begin;
set local app.auvo_sync_write='true';
insert into pcm.retorno_os_preparado(id,cliente_id,os_id,versao_id,rotina_id,chave_evento,origem)
values ('17390000-0000-4000-8000-000000000015','17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000014','17390000-0000-4000-8000-000000000008','17390000-0000-4000-8000-000000000009','s173-race-retorno','manual_declarado');
\echo A_RETORNO_INSERIDO
select pg_sleep(15);
commit;
