-- Estado inicial conferido: todos os cinco gates fechados; execute após o teste, também em caso de falha.
begin;
update pcm.sso_finalizar_os_validada_gate set habilitado=false where id;
update pcm.sso_atestacao_pcm_gate set habilitado=false where id;
update pcm.validacao_os_gate set habilitado=false where id;
update pcm.sso_upload_evidencia_resposta_gate set habilitado=false where id;
update pcm.sso_validacao_resposta_gate set habilitado=false where id;
revoke all on function pcm.sso_finalizar_os_validada_v2(uuid,uuid,uuid,uuid,uuid,integer,text,timestamptz) from public,anon,authenticated,service_role;
commit;
