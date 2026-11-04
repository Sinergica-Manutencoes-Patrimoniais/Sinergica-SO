-- Fixture mista: testa somente o guardião da ocorrência, não a validade da origem.
begin;
\ir E01-S173_retorno_aprovado_fixture.sql
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(4);
select lives_ok($$update pcm.ocorrencias_preventivas set vencimento='2026-01-02' where id='16891000-0000-4000-8000-000000000014'$$,'gate desligado preserva alteração existente');
update pcm.sso_integridade_retorno_calendario_gate set habilitado=true where id;
select lives_ok($$update pcm.ocorrencias_preventivas set vencimento=vencimento where id='16891000-0000-4000-8000-000000000014'$$,'alteração sem mudança continua permitida');
select throws_ok($$update pcm.ocorrencias_preventivas set vencimento='2026-01-03' where id='16891000-0000-4000-8000-000000000014'$$,'23514','ocorrencia_com_retorno_origem_imutavel','vencimento com retorno é imutável');
select throws_ok($$delete from pcm.ocorrencias_preventivas where id='16891000-0000-4000-8000-000000000014'$$,'23514','ocorrencia_com_retorno_origem_imutavel','exclusão com retorno é recusada');
select * from finish();
rollback;
