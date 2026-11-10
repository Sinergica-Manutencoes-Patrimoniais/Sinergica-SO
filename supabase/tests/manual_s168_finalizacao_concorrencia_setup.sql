-- Exclusivamente banco descartável. Cria fixtures persistentes append-only e abre gates temporariamente.
\set ON_ERROR_STOP on
begin;
\i supabase/tests/E01-S168_finalizacao_fixture_real.sql
update pcm.sso_finalizar_os_validada_gate set habilitado=true where id;
update pcm.sso_atestacao_pcm_gate set habilitado=true where id;
update pcm.validacao_os_gate set habilitado=true where id;
update pcm.sso_upload_evidencia_resposta_gate set habilitado=true where id;
update pcm.sso_validacao_resposta_gate set habilitado=true where id;
grant execute on function pcm.sso_finalizar_os_validada_v2(uuid,uuid,uuid,uuid,uuid,integer,text,timestamptz) to authenticated;
commit;
