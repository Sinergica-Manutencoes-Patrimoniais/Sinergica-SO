-- Fixture deliberadamente incompatível: ocorrência Grupo e Plano legado Sistema.
begin;
\ir E01-S168_opcional_aprovacao_fixture.sql
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(3);
update pcm.origem_campo_inbox_gate set habilitado=true where id;
update pcm.validacao_os_gate set habilitado=true where id;
update pcm.sso_origem_execucao_unificada_gate set habilitado=true where id;
update pcm.sso_integridade_retorno_calendario_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select throws_ok($$select pcm.sso_resolver_origem_execucao('16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000014')$$,'23514','origem_incompativel','resolvedor rejeita origem incompatível');
select throws_ok($$select pcm.sso_classificar_retorno_campo_manual('16891000-0000-4000-8000-000000000037','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000035','16891000-0000-4000-8000-000000000036','16891000-0000-4000-8000-000000000038','[{"perguntaId":"p1","resultado":"nao_inspecionado"},{"perguntaId":"p2","resultado":"nao_ok"}]')$$,'23514','origem_incompativel','classificador rejeita origem incompatível');
select is((select count(*)::integer from pcm.retorno_os_preparado where id='16891000-0000-4000-8000-000000000038'),0,'retorno divergente não é criado');
select * from finish();
rollback;
