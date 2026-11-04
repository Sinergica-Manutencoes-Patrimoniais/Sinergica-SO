-- Banco diagnóstico descartável. A função permanece desconectada de policies.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(7);
select has_function('pcm','sso_s180_dispatch_autorizacao_privada',array['text','text','text'],
  'existe dispatcher privado com serialização de autorização');
select ok(not has_function_privilege('authenticated','pcm.sso_s180_dispatch_autorizacao_privada(text,text,text)','execute'),'authenticated não pode chamar');
select ok(not has_function_privilege('anon','pcm.sso_s180_dispatch_autorizacao_privada(text,text,text)','execute'),'anon não pode chamar');
select ok(not has_function_privilege('service_role','pcm.sso_s180_dispatch_autorizacao_privada(text,text,text)','execute'),'service_role não pode chamar');
select ok((select prosecdef and provolatile='v' from pg_proc where oid='pcm.sso_s180_dispatch_autorizacao_privada(text,text,text)'::regprocedure),'dispatcher usa execução privada volatile');
select is(pcm.sso_s180_dispatch_autorizacao_privada('desconhecido','arquivo','dono'),false,'bucket desconhecido é negado');
select is((select count(*)::integer from pg_policies where schemaname='storage' and tablename='objects' and coalesce(with_check,'') like '%sso_s180_dispatch_autorizacao_privada%'),0,'nenhuma policy conectada');
select * from finish();
rollback;
