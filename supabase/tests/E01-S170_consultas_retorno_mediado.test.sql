-- Corrige regressão de runtime sem liberar gates fora desta transação descartável.
begin;
\ir E01-S173_retorno_aprovado_fixture.sql
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(5);

update pcm.origem_campo_inbox_gate set habilitado=true where id;
update pcm.validacao_os_gate set habilitado=true where id;
update pcm.sso_revisao_validacao_os_gate set habilitado=true where id;
update pcm.sso_classificacao_retorno_mediada_gate set leitura=true,escrita=true where id;
update pcm.sso_mediacao_pendencias_retorno_gate set habilitado=true where id;
update pcm.sso_conferencia_cobertura_retorno_gate set habilitado=true where id;
update pcm.sso_condicao_evidencia_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select lives_ok($$select * from pcm.sso_listar_evidencias_declaradas_mediada(
  '16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018',null,20)$$,
  'consulta mediada de evidências executa sem conflito com OUT id');
select lives_ok($$select * from pcm.sso_listar_decisoes_retorno_mediado(
  '16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018',null,20)$$,
  'consulta mediada de decisões permanece disponível com gate habilitado');
select lives_ok($$select * from pcm.sso_listar_conferencias_cobertura_mediada(
  '16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018',null,20)$$,
  'consulta mediada de conferências executa sem conflito com OUT id');
select lives_ok($$select * from pcm.sso_listar_reatestacoes_mediada(
  '16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018',
  '16891000-0000-4000-8000-000000000099',null,20)$$,
  'consulta mediada de reatestações executa sem conflito com OUT id');
select lives_ok($$select * from pcm.sso_listar_condicoes_evidencia_mediada(
  '16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018',null,20)$$,
  'consulta mediada de condições executa sem conflito com OUT id');

reset role;
select * from finish();
rollback;
