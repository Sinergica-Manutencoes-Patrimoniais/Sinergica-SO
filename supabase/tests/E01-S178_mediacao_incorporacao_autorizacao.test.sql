-- Teste transacional de fronteira; não substitui cenário de incorporação aprovada real.
begin;
set local app.auvo_sync_write='true';
select plan(4);
set local request.jwt.claims='{"sub":"17799500-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$select pcm.sso_incorporar_ativo_autorizado('17799500-0000-0000-0000-000000000050','17799500-0000-0000-0000-000000000051',1,'linha',null,null,null,null,null,null,0)$$,'55000','conferencia_desabilitada','gate fechado impede incorporação');
reset role;
update pcm.sso_mediacao_conferencia_gate set habilitado=true where id;
set local role authenticated;
select throws_ok($$select pcm.sso_incorporar_ativo_autorizado('17799500-0000-0000-0000-000000000050','17799500-0000-0000-0000-000000000051',1,'linha',null,null,null,null,null,null,0)$$,'42501','sem_acesso','lote desconhecido ou Cliente não autorizado é negado');
select ok(not has_function_privilege('authenticated','pcm.sso_incorporar_ativo_codigo_staging(uuid,uuid,integer,text,uuid,uuid,uuid,uuid,text,bigint,integer)','EXECUTE'),'núcleo de incorporação continua privado');
select ok(has_function_privilege('authenticated','pcm.sso_incorporar_ativo_autorizado(uuid,uuid,integer,text,uuid,uuid,uuid,uuid,text,bigint,integer)','EXECUTE'),'assinatura mediada continua disponível');
reset role;
select * from finish();
rollback;
