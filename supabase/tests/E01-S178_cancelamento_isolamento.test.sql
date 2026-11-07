-- Requer migrations 0984/0986/0987 em banco diagnóstico isolado.
set search_path=public,extensions;
begin isolation level repeatable read;
select plan(1);
select throws_ok($$select pcm.sso_cancelar_ingestao_foto(null,null,null,null,null)$$,'25001',null,'repeatable read falha fechado');
select * from finish();
rollback;
