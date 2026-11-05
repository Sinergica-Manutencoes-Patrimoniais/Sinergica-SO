-- Só clone sintético descartável, migrations até 1811. ON_ERROR_STOP e ROLLBACK.
-- Testa a policy SQL com claims sintéticas; não substitui Auth/Storage HTTP.
\ir E01-S168_finalizacao_fixture_real.sql
update pcm.validacao_os_gate set habilitado=true where id;
update pcm.sso_upload_evidencia_resposta_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
do $$
declare
 caminho text := '16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000018/16891000-0000-4000-8000-000000000090';
 outro text := '16891000-0000-4000-8000-000000000099/16891000-0000-4000-8000-000000000018/16891000-0000-4000-8000-000000000091';
begin
 if pcm.sso_autorizar_upload_evidencia_resposta(caminho) is distinct from true then raise exception 'predicado_permitido_recusado'; end if;
 if pcm.sso_autorizar_upload_evidencia_resposta(outro) is distinct from false then raise exception 'predicado_cliente_divergente_aceito'; end if;
 insert into storage.objects(bucket_id,name,owner_id) values('sso-retorno-evidencias',caminho,auth.uid()::text);
 begin
   insert into storage.objects(bucket_id,name,owner_id) values('sso-retorno-evidencias',outro,auth.uid()::text);
   raise exception 'upload_cliente_divergente_aceito';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update pcm.sso_upload_evidencia_resposta_gate set habilitado=false where id;
set local role authenticated;
do $$ begin
 if pcm.sso_autorizar_upload_evidencia_resposta('16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000018/16891000-0000-4000-8000-000000000092') is distinct from false then raise exception 'gate_fechado_aceito'; end if;
end $$;
reset role;
