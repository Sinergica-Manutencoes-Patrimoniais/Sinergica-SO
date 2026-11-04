-- Banco isolado; a fixture é sintética e toda a preparação é revertida.
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set local search_path=extensions,public;
select plan(21);
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select ok(not has_function_privilege('authenticated','pcm.sso_listar_condicoes_estruturais_retorno(uuid,uuid,uuid,integer)','execute'), 'condições privadas permanecem revogadas');
select ok(not has_function_privilege('authenticated','pcm.sso_listar_revisoes_validacao_os(uuid,uuid,integer,integer)','execute'), 'decisões privadas permanecem revogadas');
select ok(not has_function_privilege('anon','pcm.sso_listar_condicoes_retorno_mediado(uuid,uuid,uuid,integer)','execute'), 'anon não consulta condições');
select ok(not has_function_privilege('anon','pcm.sso_listar_decisoes_retorno_mediado(uuid,uuid,integer,integer)','execute'), 'anon não consulta decisões');
select ok(not has_function_privilege('anon','pcm.sso_listar_pendencias_contexto_mediado(uuid,uuid,integer)','execute'), 'anon não consulta Pendências');
select throws_ok($$select * from pcm.sso_listar_condicoes_retorno_mediado('16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018',null,20)$$,'55000',null,'gate da mediação bloqueia condições');
update pcm.sso_mediacao_pendencias_retorno_gate set habilitado=true where id;
update pcm.validacao_os_gate set habilitado=true where id;
update pcm.sso_revisao_validacao_os_gate set habilitado=true where id;
update pcm.sso_condicao_retorno_gate set habilitado=true where id;
update pcm.sso_pendencias_gate set habilitado=true where id;
-- Outra conexão segura trava exclusiva do protocolo, simulando revogação concorrente.
-- Não altera concessões ou outros dados e é desconectada antes do rollback.
-- Somente Supabase local descartável; credencial padrão do banco de teste.
select extensions.dblink_connect('s173_lock',format('hostaddr=%s port=%s dbname=%L user=postgres password=postgres connect_timeout=5',inet_server_addr(),inet_server_port(),current_database()));
select extensions.dblink_exec('s173_lock','begin');
select extensions.dblink_exec('s173_lock',$remote$do $block$ begin if not pg_try_advisory_xact_lock(hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'trava de teste indisponível'; end if; end $block$$remote$);
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_condicoes_retorno_mediado('16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018',null,20)$$,'55P03',null,'condições falham fechadas durante alteração de autorização');
select throws_ok($$select * from pcm.sso_listar_decisoes_retorno_mediado('16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018',null,20)$$,'55P03',null,'decisões falham fechadas durante alteração de autorização');
select throws_ok($$select * from pcm.sso_listar_pendencias_contexto_mediado('16891000-0000-4000-8000-000000000002',null,20)$$,'55P03',null,'lista falha fechada durante alteração de autorização');
select throws_ok($$select pcm.sso_preparar_pendencias_retorno_mediado('17391000-0000-4000-8000-000000000001','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000027',1)$$,'55P03',null,'preparação falha fechada durante alteração de autorização');
reset role;
select extensions.dblink_exec('s173_lock','rollback');
select extensions.dblink_disconnect('s173_lock');
\ir E01-S173_retorno_aprovado_fixture.sql
insert into pcm.clientes(id,nome,ativo,created_by) values ('17391000-0000-4000-8000-000000000002','Outro Cliente sintético',true,'16891000-0000-4000-8000-000000000001');
set local role authenticated;
select is((select count(*)::integer from pcm.sso_listar_condicoes_retorno_mediado('16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018',null,20)),1,'Cliente autorizado consulta condição');
select is((select decisao from pcm.sso_listar_decisoes_retorno_mediado('16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018',null,20)),'aprovar','Cliente autorizado consulta decisão');
select is((select count(*)::integer from pcm.sso_listar_decisoes_retorno_mediado('16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018',1,20)),0,'cursor de decisão preservado');
select throws_ok($$select * from pcm.sso_listar_condicoes_retorno_mediado('16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018',null,101)$$,'22023',null,'paginação inválida rejeitada pelo núcleo');
select throws_ok($$select * from pcm.sso_listar_decisoes_retorno_mediado('16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000099',null,20)$$,'42501',null,'retorno de outro escopo é indisponível');
select ok(not has_function_privilege('authenticated','pcm.sso_listar_pendencias_contexto(uuid,uuid,integer)','execute'), 'lista privada de Pendências continua revogada');
select is((pcm.sso_preparar_pendencias_retorno_mediado('17391000-0000-4000-8000-000000000001','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000027',1)->>'pendenciasProcessadas')::integer,1,'prepara Pendência sintética');
select is((select count(*)::integer from pcm.sso_listar_pendencias_contexto_mediado('16891000-0000-4000-8000-000000000002',null,20)),1,'Pendência criada aparece na lista mediada');
select throws_ok($$select * from pcm.sso_listar_pendencias_contexto_mediado('17391000-0000-4000-8000-000000000002',null,20)$$,'42501',null,'Cliente sem concessão não é consultado');
set local request.jwt.claims='{"sub":"17391000-0000-4000-8000-000000000099","role":"authenticated","user_role":"superadmin"}';
select throws_ok($$select * from pcm.sso_listar_condicoes_retorno_mediado('16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018',null,20)$$,'42501',null,'usuário sem concessão não consulta');
select throws_ok($$select * from pcm.sso_listar_pendencias_contexto_mediado('16891000-0000-4000-8000-000000000002',null,20)$$,'42501',null,'usuário sem concessão não lista Pendências');
reset role;
select * from finish();
rollback;
