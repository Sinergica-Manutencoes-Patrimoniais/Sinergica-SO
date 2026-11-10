-- Executar em cluster descartável, com migrations na mesma transação; rollback integral.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(4);
select ok(has_function_privilege('authenticated','pcm.sso_converter_chamado_integral_autorizado(uuid,bigint,uuid,uuid,uuid,jsonb,text,text)','execute') and not has_function_privilege('anon','pcm.sso_converter_chamado_integral_autorizado(uuid,bigint,uuid,uuid,uuid,jsonb,text,text)','execute') and not has_function_privilege('authenticated','pcm.sso_converter_chamado_integral(uuid,bigint,uuid,uuid,uuid,jsonb,text,text)','execute'),'wrapper autenticado sem acesso ao núcleo');
select throws_ok($$select pcm.sso_converter_chamado_integral_autorizado('16797005-0000-4000-8000-000000000001',1,'16797005-0000-4000-8000-000000000002','16797005-0000-4000-8000-000000000003','16797005-0000-4000-8000-000000000004','{}','backlog',null)$$,'55000','conversao_integral_mediada_bloqueada','gate de mediação fechado');
-- Clone restaurado com --no-privileges; reproduz USAGE já existente no schema de diagnóstico.
grant usage on schema pcm to authenticated;
set local role authenticated;
select throws_ok($$select pcm.sso_converter_chamado_integral_autorizado('16797005-0000-4000-8000-000000000001',1,'16797005-0000-4000-8000-000000000002','16797005-0000-4000-8000-000000000003','16797005-0000-4000-8000-000000000004','{}','backlog',null)$$,'55000','conversao_integral_mediada_bloqueada','gate bloqueia também chamada authenticated');
reset role;
select is((select habilitado from pcm.sso_conversao_integral_mediada_gate where id),false,'gate permanece fechado');
select * from finish();
rollback;
