-- Somente fixture sintética e transação revertida.
begin;
\ir E01-S168_origem_calendario_valida_fixture.sql
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(4);
update pcm.origem_campo_inbox_gate set habilitado=true where id;
update pcm.validacao_os_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select is((select habilitado from pcm.sso_integridade_retorno_calendario_gate where id),false,'guarda começa fechada');
update pcm.sso_integridade_retorno_calendario_gate set habilitado=true where id;
select throws_ok($$select pcm.sso_classificar_retorno_campo_manual('16891000-0000-4000-8000-000000000037','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000035','16891000-0000-4000-8000-000000000036','16891000-0000-4000-8000-000000000038','[{"perguntaId":"p1","resultado":"nao_inspecionado"},{"perguntaId":"p2","resultado":"nao_ok"}]')$$,'55000','origem_execucao_bloqueada','resolvedor fechado impede classificação');
update pcm.sso_origem_execucao_unificada_gate set habilitado=true where id;
select is((pcm.sso_classificar_retorno_campo_manual('16891000-0000-4000-8000-000000000037','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000035','16891000-0000-4000-8000-000000000036','16891000-0000-4000-8000-000000000038','[{"perguntaId":"p1","resultado":"nao_inspecionado"},{"perguntaId":"p2","resultado":"nao_ok"}]')->>'retornoId'),'16891000-0000-4000-8000-000000000038','origem calendário compatível pode ser classificada');
select is((select obrigatoria from pcm.respostas_os_preparadas where retorno_id='16891000-0000-4000-8000-000000000038' and chave_pergunta='p1'),false,'opcionalidade permanece preservada');
select * from finish();
rollback;
