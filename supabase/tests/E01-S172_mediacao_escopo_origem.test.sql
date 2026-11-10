select plan(4);
select ok(has_function_privilege('authenticated','pcm.sso_mediar_escopo_origem(uuid,uuid,uuid,integer,text,text,text)','execute'),'mediador disponível');
select ok(not has_function_privilege('authenticated','pcm.sso_declarar_escopo_origem(uuid,uuid,uuid,integer,text,text,text)','execute'),'comando interno continua privado');
select throws_ok($$select pcm.sso_consultar_escopo_autorizado(null,null)$$,'55000','escopo_origem_bloqueado','consulta respeita gate');
select ok(not has_table_privilege('authenticated','pcm.sso_escopo_origem_declaracoes','SELECT'),'tabela não é exposta');
select * from finish();
