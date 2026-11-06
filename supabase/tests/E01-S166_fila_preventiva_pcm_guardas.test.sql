-- Verificações de fronteira; não substituem a fixture integrada de inclusão/cancelamento e concorrência.
begin;
select plan(5);
select ok(has_function_privilege('authenticated','pcm.sso_alterar_fila_preventiva_pcm(uuid,uuid,uuid,uuid,text,integer,text)','execute'),'comando tem entrada autenticada');
select ok(not has_function_privilege('anon','pcm.sso_alterar_fila_preventiva_pcm(uuid,uuid,uuid,uuid,text,integer,text)','execute'),'anon não executa comando');
select ok(not has_table_privilege('authenticated','pcm.sso_fila_preventiva_pcm','INSERT'),'usuário não grava fila diretamente');
select throws_ok($$select pcm.sso_alterar_fila_preventiva_pcm(null,null,null,null,null,null,null)$$,'55000','fila_desabilitada','gate fechado impede comando');
select throws_ok($$select * from pcm.sso_listar_fila_preventiva_pcm(null,null,null,null)$$,'55000','fila_desabilitada','gate fechado impede consulta');
select * from finish();
rollback;
