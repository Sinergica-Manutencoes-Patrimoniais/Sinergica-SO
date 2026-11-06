-- Banco sintético isolado; nenhuma OS ou tarefa Auvo é criada.
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
\ir E01-S168_finalizacao_fixture_real.sql
select plan(9);
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($q$select pcm.sso_triar_ciclo_atrasado('16891000-0000-4000-8000-000000000090','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015',0,'2026-02-01','avaliar','Conferido')$q$,'55000',null,'gate fechado impede triagem');
reset role;
update pcm.sso_triagem_atraso_gate set habilitado=true where id;
set local role authenticated;
select throws_ok($q$select pcm.sso_triar_ciclo_atrasado('16891000-0000-4000-8000-000000000090','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015',0,'2026-02-01','avaliar','Conferido')$q$,'42501',null,'exige capacidade de gestão');
reset role;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16891000-0000-4000-8000-000000000001','plano.gerir','16891000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*)::integer from pcm.sso_listar_candidatos_atraso('16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000007','16891000-0000-4000-8000-000000000009','2026-02-01',null,20)),1,'candidato elegível é listado');
select is((pcm.sso_triar_ciclo_atrasado('16891000-0000-4000-8000-000000000090','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015',0,'2026-02-01','avaliar','Conferido')->>'revisao')::integer,1,'triagem registra revisão');
select is((pcm.sso_triar_ciclo_atrasado('16891000-0000-4000-8000-000000000090','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015',0,'2026-02-01','avaliar','Conferido')->>'revisao')::integer,1,'replay devolve mesma revisão');
select throws_ok($q$select pcm.sso_triar_ciclo_atrasado('16891000-0000-4000-8000-000000000090','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015',0,'2026-02-01','tratar_manualmente','Conferido')$q$,'23505',null,'requestId divergente é recusado');
select throws_ok($q$select pcm.sso_triar_ciclo_atrasado('16891000-0000-4000-8000-000000000091','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015',0,'2026-02-01','avaliar','Conferido')$q$,'40001',null,'revisão obsoleta é recusada');
select throws_ok($q$select pcm.sso_triar_ciclo_atrasado('16891000-0000-4000-8000-000000000092','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015',1,'2026-01-01','avaliar','Conferido')$q$,'23514',null,'vencimento dentro da tolerância não é candidato');
reset role;
select is((select count(*)::integer from pcm.sso_triagens_atraso where preparada_id='16891000-0000-4000-8000-000000000015'),1,'replay não duplica triagem');
select * from finish();
rollback;
