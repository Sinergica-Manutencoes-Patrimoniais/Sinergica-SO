-- Exercita proteção já existente do plano legado; não comprova concorrência de outras fontes.
begin;
\ir E01-S173_retorno_aprovado_fixture.sql
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
insert into pcm.sistemas(id,cliente_id,nome) values ('16891000-0000-4000-8000-000000000021','16891000-0000-4000-8000-000000000002','Outro sistema sintético');
select plan(7);
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$update pcm.planos_preventivos set sistema_id='16891000-0000-4000-8000-000000000021' where id='16891000-0000-4000-8000-000000000013'$$,'P0001','Plano com ocorrências: crie outro plano para mudar alvo ou recorrência','alvo do plano existente é protegido');
select throws_ok($$update pcm.planos_preventivos set cliente_id='16891000-0000-4000-8000-000000000021' where id='16891000-0000-4000-8000-000000000013'$$,'P0001','Plano com ocorrências: crie outro plano para mudar alvo ou recorrência','cliente do plano existente é protegido');
select lives_ok($$update pcm.planos_preventivos set nome='Plano sintético renomeado' where id='16891000-0000-4000-8000-000000000013'$$,'campo não estrutural continua alterável');
select lives_ok($$update pcm.planos_preventivos set sistema_id=sistema_id where id='16891000-0000-4000-8000-000000000013'$$,'atribuição sem mudança continua permitida');
reset role;
select throws_ok($$update pcm.plano_versoes set snapshot='{}'::jsonb where id='16891000-0000-4000-8000-000000000008'$$,'23514','versao_aprovada_imutavel','snapshot aprovado não é alterável');
select throws_ok($$delete from pcm.plano_versoes where id='16891000-0000-4000-8000-000000000008'$$,'23514','versao_aprovada_imutavel','versão aprovada não é excluível');
select ok(not has_table_privilege('service_role','pcm.ocorrencias_rotina_vinculos','UPDATE') and not has_table_privilege('authenticated','pcm.ocorrencias_rotina_vinculos','UPDATE'),'ponte não admite update direto por papéis operacionais');
select * from finish();
rollback;
