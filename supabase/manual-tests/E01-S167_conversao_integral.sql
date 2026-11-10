-- Executar após aplicar 1047 em transação de teste em cluster descartável. Rollback integral.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(4);
select ok(not has_function_privilege('authenticated','pcm.sso_converter_chamado_integral(uuid,bigint,uuid,uuid,uuid,jsonb,text,text)','execute'),'comando integral segue privado');
select throws_ok($$select pcm.sso_converter_chamado_integral('16797003-0000-4000-8000-000000000001',1,'16797003-0000-4000-8000-000000000002','16797003-0000-4000-8000-000000000003','16797003-0000-4000-8000-000000000004','{}','backlog',null)$$,'55000','criacao_multipla_bloqueada','gate real fechado');
update pcm.chamado_os_gate set habilitado=true where id;
select throws_ok($$select pcm.sso_converter_chamado_integral('16797003-0000-4000-8000-000000000001',1,'16797003-0000-4000-8000-000000000002','16797003-0000-4000-8000-000000000003','16797003-0000-4000-8000-000000000004','{}','backlog',null)$$,'55000','transicao_legada_incompleta','restrições legadas bloqueiam mesmo com gate aberto no teste');
update pcm.chamado_os_gate set habilitado=false where id;
select is((select habilitado from pcm.chamado_os_gate where id),false,'gate real não alterado');
select * from finish();
rollback;
