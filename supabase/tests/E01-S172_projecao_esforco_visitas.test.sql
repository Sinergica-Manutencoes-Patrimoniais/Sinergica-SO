begin;
\ir E01-S172_snapshot_capacidade_fixture.sql
select plan(9);
select ok(has_function_privilege('authenticated','pcm.sso_fontes_esforco_autorizadas(uuid,date,uuid,integer)','execute'),'projeção mediada disponível');
select ok(not has_function_privilege('authenticated','pcm.sso_listar_fontes_demanda_visita(uuid,date,uuid,integer)','execute'),'fonte original privada');
select throws_ok($$select * from pcm.sso_fontes_esforco_autorizadas(null,null,null,50)$$,'55000','esforco_capacidade_bloqueado','gate de esforço fechado');
select ok(not has_table_privilege('authenticated','pcm.capacidade_esforco_declaracoes','SELECT'),'declarações sem leitura direta');
update pcm.capacidade_esforco_declarado_gate set habilitado=true where id;
update pcm.capacidade_fontes_mediacao_gate set habilitado=true where id;
update pcm.capacidade_demanda_gate set habilitado=true where id;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16896000-0000-4000-8000-000000000001','capacidade.gerir','16896000-0000-4000-8000-000000000002');
insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,created_by) values
 ('17296000-0000-4000-8000-000000000040','16896000-0000-4000-8000-000000000002','2026-10-27 12:00Z','2026-10-27 13:00Z','America/Sao_Paulo','regular','16896000-0000-4000-8000-000000000001');
insert into pcm.visita_ordens_servico(id,visita_id,os_id,cliente_id,sequencia,estimativa_minutos,created_by) values
 ('17296000-0000-4000-8000-000000000041','17296000-0000-4000-8000-000000000040','16896000-0000-4000-8000-000000000017','16896000-0000-4000-8000-000000000002',1,60,'16896000-0000-4000-8000-000000000001');
set local request.jwt.claims = '{"sub":"16896000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is((select esforco_revision from pcm.sso_fontes_esforco_autorizadas('16896000-0000-4000-8000-000000000002','2026-10-26',null,1)),0,'OS sem declaração está pendente');
select is(pcm.sso_mediar_declaracao_esforco('17296000-0000-4000-8000-000000000042','16896000-0000-4000-8000-000000000002','os','16896000-0000-4000-8000-000000000017',0,null,120,30,'declarado')->>'revision','1','declaração autorizada');
select is((select terceiros_minutos from pcm.sso_fontes_esforco_autorizadas('16896000-0000-4000-8000-000000000002','2026-10-26',null,1)),120,'valor de terceiros projetado sem somar');
select is((select internos_minutos from pcm.sso_fontes_esforco_autorizadas('16896000-0000-4000-8000-000000000002','2026-10-26',null,1)),null::integer,'esforço próprio desconhecido preservado');
select throws_ok($$select * from pcm.sso_fontes_esforco_autorizadas('16895000-0000-4000-8000-000000000002','2026-10-26',null,50)$$,'42501','capacidade_nao_encontrada_ou_sem_acesso','outro Cliente negado');
reset role;
select * from finish();
rollback;
