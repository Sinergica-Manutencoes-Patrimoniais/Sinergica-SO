-- Exercita staging canônico em transação revertida; fixture usada para Cliente e sistema.
begin;
\ir E01-S168_origem_calendario_valida_fixture.sql
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
insert into config.sso_acoes(codigo,modulo,nivel,exige_concessao_individual) values('plano.gerir','pcm','escrita',false) on conflict do nothing;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('16891000-0000-4000-8000-000000000001','plano.gerir','16891000-0000-4000-8000-000000000002');
insert into pcm.sso_cronograma_staging_gate(id,habilitado) values(true,true) on conflict(id) do update set habilitado=true;
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select plan(11);
select throws_ok($$select pcm.sso_classificar_cronograma_mediado('16900000-0000-4000-8000-000000000011','16900000-0000-4000-8000-000000000002',1,'1','dado','pendente','Conferir')$$,'55000','mediacao_cronograma_bloqueada','gate desligado impede classificação');
update pcm.sso_mediacao_cronograma_gate set habilitado=true where id;
set local role authenticated;
select pcm.sso_receber_cronograma_mediado('16900000-0000-4000-8000-000000000001','16900000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000002','teste','[[1],[2],[3],[4],[5]]');
select lives_ok($$select pcm.sso_classificar_cronograma_mediado('16900000-0000-4000-8000-000000000011','16900000-0000-4000-8000-000000000002',1,'1','dado','pendente','Conferir')$$,'classifica linha canônica');
select lives_ok($$select pcm.sso_classificar_cronograma_mediado('16900000-0000-4000-8000-000000000011','16900000-0000-4000-8000-000000000002',1,'1','dado','pendente','Conferir')$$,'replay de classificação idempotente');
select throws_ok($$select pcm.sso_classificar_cronograma_mediado('16900000-0000-4000-8000-000000000011','16900000-0000-4000-8000-000000000002',1,'1','ignorada','pendente','Conferir')$$,'23505','request_id_conflitante','replay divergente recusado');
select lives_ok($$select pcm.sso_mapear_cronograma_mediado('16900000-0000-4000-8000-000000000012','16900000-0000-4000-8000-000000000002',2,1,'Elétrica','Rotina','sistema','16891000-0000-4000-8000-000000000020','calendario',1,'meses','2026-01-01',null,'calendario_real')$$,'mapeia alvo do Cliente');
select lives_ok($$select pcm.sso_mapear_cronograma_mediado('16900000-0000-4000-8000-000000000012','16900000-0000-4000-8000-000000000002',2,1,'Elétrica','Rotina','sistema','16891000-0000-4000-8000-000000000020','calendario',1,'meses','2026-01-01',null,'calendario_real')$$,'replay do mapeamento é idempotente');
select throws_ok($$select pcm.sso_mapear_cronograma_mediado('16900000-0000-4000-8000-000000000013','16900000-0000-4000-8000-000000000002',2,1,'Elétrica','Rotina','sistema','16891000-0000-4000-8000-000000000020','calendario',1,'meses','2026-01-01',null,'calendario_real')$$,'40001','revisao_obsoleta','revisão antiga recusada');
select is((select count(*)::int from pcm.sso_listar_mapeamentos_mediado('16891000-0000-4000-8000-000000000002','16900000-0000-4000-8000-000000000002',null,20)),1,'mapeamento consultável');
select is((select count(*)::int from pcm.sso_listar_alvos_cronograma_mediado('16891000-0000-4000-8000-000000000002','sistema',null,'',20)),1,'seletor lista alvo autorizado');
select throws_ok($$select pcm.sso_mapear_cronograma_mediado('16900000-0000-4000-8000-000000000014','16900000-0000-4000-8000-000000000002',3,1,'Elétrica','Rotina','sistema','16891000-0000-4000-8000-000000000099','calendario',1,'meses','2026-01-01',null,'calendario_real')$$,'23514','alvo_invalido_ou_de_outro_cliente','alvo inexistente ou de outro Cliente recusado');
select throws_ok($$select * from pcm.sso_listar_alvos_cronograma_mediado('16891000-0000-4000-8000-000000000099','sistema',null,'',20)$$,'42501','lote_sem_acesso','outro Cliente negado');
reset role;
select * from finish();
rollback;
