-- Fixture é reutilizada apenas para usuário e Cliente; nenhuma origem de OS é validada aqui.
begin;
\ir E01-S168_origem_calendario_valida_fixture.sql
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
insert into config.sso_acoes(codigo,modulo,nivel,exige_concessao_individual) values('plano.gerir','pcm','escrita',false) on conflict do nothing;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('16891000-0000-4000-8000-000000000001','plano.gerir','16891000-0000-4000-8000-000000000002');
insert into pcm.sso_cronograma_staging_gate(id,habilitado) values(true,true) on conflict(id) do update set habilitado=true;
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select plan(10);
select throws_ok($$select pcm.sso_receber_cronograma_mediado('16900000-0000-4000-8000-000000000001','16900000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000002','teste','[[1],[2],[3],[4],[5]]')$$,'55000','mediacao_cronograma_bloqueada','gate fechado bloqueia recepção');
update pcm.sso_mediacao_cronograma_gate set habilitado=true where id;
set local role authenticated;
select lives_ok($$select pcm.sso_receber_cronograma_mediado('16900000-0000-4000-8000-000000000001','16900000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000002','teste','[[1],[2],[3],[4],[5]]')$$,'recepção cria lote canônico');
select lives_ok($$select pcm.sso_receber_cronograma_mediado('16900000-0000-4000-8000-000000000001','16900000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000002','teste','[[1],[2],[3],[4],[5]]')$$,'repetição é idempotente');
select throws_ok($$select pcm.sso_receber_cronograma_mediado('16900000-0000-4000-8000-000000000001','16900000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000002','teste','[[1],[2],[3],[4],[6]]')$$,'23505','request_id_conflitante','mesmo request com conteúdo divergente é recusado');
select throws_ok($$select pcm.sso_receber_cronograma_unificado('16900000-0000-4000-8000-000000000005','16900000-0000-4000-8000-000000000006','16891000-0000-4000-8000-000000000002','privado','[[1],[2],[3],[4],[5]]')$$,'42501',null,'núcleo original permanece privado');
select is((select count(*)::int from pcm.sso_listar_cronogramas_mediado('16891000-0000-4000-8000-000000000002',null,20)),1,'listagem retorna lote autorizado');
select is(pcm.sso_obter_cronograma_mediado('16891000-0000-4000-8000-000000000002','16900000-0000-4000-8000-000000000002')->>'fonteId','teste','detalhe retorna origem correta');
select throws_ok($$select pcm.sso_obter_cronograma_mediado('16891000-0000-4000-8000-000000000099','16900000-0000-4000-8000-000000000002')$$,'42501','lote_sem_acesso','outro Cliente negado');
select lives_ok($$select pcm.sso_anotar_cronograma_mediado('16900000-0000-4000-8000-000000000003','16900000-0000-4000-8000-000000000002',1,1,'Conferência sintética')$$,'anotação usa revisão do lote');
select throws_ok($$select pcm.sso_anotar_cronograma_mediado('16900000-0000-4000-8000-000000000004','16900000-0000-4000-8000-000000000002',1,1,'Conferência antiga')$$,'40001','revisao_obsoleta','revisão antiga recusada');
reset role;
select * from finish();
rollback;
