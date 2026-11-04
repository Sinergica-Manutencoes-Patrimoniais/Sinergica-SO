-- Rodar apenas em base descartável com migrations aplicadas.
\set ON_ERROR_STOP on
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(8);
select has_function('pcm','sso_s180_dispatch_storage_experimental',array['text','text','text'],'dispatcher existe');
select has_function('pcm','sso_s180_guard_storage_experimental',array['text'],'guarda existe');
select ok(not has_function_privilege('authenticated','pcm.sso_s180_dispatch_storage_experimental(text,text,text)','execute'),'dispatcher não é exposto a authenticated');
select ok(not has_function_privilege('anon','pcm.sso_s180_dispatch_storage_experimental(text,text,text)','execute'),'dispatcher não é exposto a anon');
select ok(not has_function_privilege('service_role','pcm.sso_s180_dispatch_storage_experimental(text,text,text)','execute'),'dispatcher não é exposto a service_role');
select ok(not has_function_privilege('authenticated','pcm.sso_s180_guard_storage_experimental(text)','execute'),'guarda não é exposta a authenticated');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects' and (coalesce(qual,'') like '%sso_s180_dispatch_storage_experimental%' or coalesce(with_check,'') like '%sso_s180_dispatch_storage_experimental%' or coalesce(qual,'') like '%sso_s180_guard_storage_experimental%' or coalesce(with_check,'') like '%sso_s180_guard_storage_experimental%')),0::bigint,'políticas não usam dispatcher experimental');
select is(pcm.sso_s180_dispatch_storage_experimental('desconhecido','arquivo','dono'),false,'bucket desconhecido negado');
select * from finish();
rollback;
