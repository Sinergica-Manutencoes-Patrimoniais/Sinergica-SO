-- Executar somente em ambiente isolado; nenhuma integração externa.
begin isolation level repeatable read;
select plan(3);
select ok(not has_function_privilege('authenticated','pcm.sso_editar_codigo_rascunho(uuid,text,uuid,integer,text,text)','EXECUTE'),'wrapper continua privado');
select ok(not has_function_privilege('authenticated','pcm.sso_editar_codigo_rascunho_base_0876(uuid,text,uuid,integer,text,text)','EXECUTE'),'núcleo continua privado');
update pcm.sso_codigo_rascunho_sem_sync_gate set habilitado=true where id;
select throws_ok($$select pcm.sso_editar_codigo_rascunho('17799500-0000-0000-0000-000000000031','sistema','17799500-0000-0000-0000-000000000011',1,'ANTIGO','NOVO')$$,'25001','isolamento_nao_suportado','snapshot antigo recusado antes do núcleo');
select * from finish();
rollback;
