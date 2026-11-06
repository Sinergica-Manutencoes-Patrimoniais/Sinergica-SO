-- Executar somente em banco isolado: fixture sintética e gates são revertidos no rollback.
-- A fixture histórica não demonstra aprovação humana nem procedência de evidências.
begin;
\ir E01-S173_retorno_aprovado_fixture.sql
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(12);

-- A resposta Não OK é inserida antes da decisão sintética. Este teste não demonstra
-- uma transição real de avaliação/validação S168 nem integridade da evidência.
set local request.jwt.claims = '{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select ok(not has_function_privilege('authenticated', 'pcm.sso_preparar_pendencias_retorno_aprovado(uuid,uuid,uuid,uuid,integer)', 'EXECUTE'),
 'núcleo não é executável por authenticated');
select ok(has_function_privilege('authenticated', 'pcm.sso_preparar_pendencias_retorno_mediado(uuid,uuid,uuid,uuid,integer)', 'EXECUTE'),
 'somente wrapper é executável por authenticated');
select ok(not has_function_privilege('anon', 'pcm.sso_preparar_pendencias_retorno_mediado(uuid,uuid,uuid,uuid,integer)', 'EXECUTE'),
 'wrapper não é executável por anon');
select throws_ok($$select pcm.sso_preparar_pendencias_retorno_mediado(
 '17391000-0000-4000-8000-000000000001','16891000-0000-4000-8000-000000000002',
 '16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000027',1)$$,
 '55000', null, 'gate da mediação começa fechado');
select throws_ok($$select pcm.sso_preparar_pendencias_retorno_aprovado(
 '17391000-0000-4000-8000-000000000001','16891000-0000-4000-8000-000000000002',
 '16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000027',1)$$,
 '55000', null, 'gate fechado impede processamento');
update pcm.validacao_os_gate set habilitado=true where id;
update pcm.sso_revisao_validacao_os_gate set habilitado=true where id;
update pcm.sso_condicao_retorno_gate set habilitado=true where id;
update pcm.sso_pendencias_gate set habilitado=true where id;
update pcm.sso_mediacao_pendencias_retorno_gate set habilitado=true where id;
set local role authenticated;
select is((pcm.sso_preparar_pendencias_retorno_mediado(
 '17391000-0000-4000-8000-000000000001','16891000-0000-4000-8000-000000000002',
 '16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000027',1)->>'pendenciasProcessadas')::integer,
 1, 'authenticated processa Não OK de retorno aprovado sintético pela mediação');
reset role;
select is((select count(*)::integer from pcm.sso_pendencias_tecnicas where resposta_id='16891000-0000-4000-8000-000000000019'),
 1, 'cria Pendência única pela resposta');
set local role authenticated;
select is((pcm.sso_preparar_pendencias_retorno_mediado(
 '17391000-0000-4000-8000-000000000001','16891000-0000-4000-8000-000000000002',
 '16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000027',1)->>'pendenciasProcessadas')::integer,
 1, 'repetição do request é idempotente');
reset role;
select is((select count(*)::integer from pcm.sso_pendencias_tecnicas where resposta_id='16891000-0000-4000-8000-000000000019'),
 1, 'repetição não duplica Pendência');
select throws_ok($$select pcm.sso_preparar_pendencias_retorno_mediado(
 '17391000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000002',
 '16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000027',2)$$,
 '40001', null, 'decisão desatualizada é rejeitada');
set local role authenticated;
select throws_ok($$update pcm.respostas_os_preparadas set resultado='ok'
 where id='16891000-0000-4000-8000-000000000019'$$,
 '42501', null, 'authenticated não altera diretamente resposta após aprovação');
reset role;
set local request.jwt.claims = '{"sub":"17391000-0000-4000-8000-000000000099","role":"authenticated","user_role":"superadmin"}';
select throws_ok($$select pcm.sso_preparar_pendencias_retorno_mediado(
 '17391000-0000-4000-8000-000000000003','16891000-0000-4000-8000-000000000002',
 '16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000027',1)$$,
 '42501', null, 'ator sem concessão não prepara pendências');
select * from finish();
rollback;
