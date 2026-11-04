-- Histórico sintético incompatível: alvo Grupo ligado a Plano legado Sistema.
begin;
\ir E01-S173_retorno_aprovado_fixture.sql
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(3);
update pcm.sso_pendencias_gate set habilitado=true where id;
update pcm.sso_origem_execucao_unificada_gate set habilitado=true where id;
update pcm.sso_integridade_retorno_calendario_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select throws_ok($$select pcm.sso_registrar_pendencia_retorno('17391000-0000-4000-8000-000000000001','16891000-0000-4000-8000-000000000019')$$,'23514','origem_incompativel','Pendência rejeita origem incompatível');
select is((select count(*)::integer from pcm.sso_pendencias_tecnicas where resposta_id='16891000-0000-4000-8000-000000000019'),0,'não persiste Pendência divergente');
update pcm.sso_integridade_retorno_calendario_gate set habilitado=false where id;
select lives_ok($$select pcm.sso_registrar_pendencia_retorno('17391000-0000-4000-8000-000000000001','16891000-0000-4000-8000-000000000019')$$,'gate fechado mantém comportamento anterior');
select * from finish();
rollback;
