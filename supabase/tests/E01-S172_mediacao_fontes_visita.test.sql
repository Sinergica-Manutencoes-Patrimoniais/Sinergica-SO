begin;
\ir E01-S172_snapshot_capacidade_fixture.sql
select plan(12);
select ok(has_function_privilege('authenticated','pcm.sso_fontes_demanda_autorizadas(uuid,date,uuid,integer)','execute'),'mediador acessível');
select ok(not has_function_privilege('authenticated','pcm.sso_listar_fontes_demanda_visita(uuid,date,uuid,integer)','execute'),'fonte interna continua privada');
select throws_ok($$select * from pcm.sso_fontes_demanda_autorizadas(null,null,null,50)$$,'55000','mediacao_fontes_capacidade_bloqueada','gate mediador fechado');
select ok(not has_table_privilege('authenticated','pcm.capacidade_fontes_mediacao_gate','UPDATE'),'gate não editável pelo usuário');
update pcm.capacidade_fontes_mediacao_gate set habilitado=true where id;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16896000-0000-4000-8000-000000000001','capacidade.gerir','16896000-0000-4000-8000-000000000002');
set local request.jwt.claims = '{"sub":"16896000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$select * from pcm.sso_fontes_demanda_autorizadas('16896000-0000-4000-8000-000000000002','2026-10-26',null,50)$$,'55000','demanda_capacidade_bloqueada','gate da fonte continua obrigatório');
reset role;
update pcm.capacidade_demanda_gate set habilitado=true where id;
set local role authenticated;
select is((select count(*) from pcm.sso_fontes_demanda_autorizadas('16896000-0000-4000-8000-000000000002','2026-10-26',null,50)),0::bigint,'consulta autorizada sem resultados');
reset role;
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,prioridade,origem,created_by)
 values('17296000-0000-4000-8000-000000000021','16896000-0000-4000-8000-000000000002','OS-S172-MEDIACAO','OS sintética','preventiva','em_execucao','media','manual','16896000-0000-4000-8000-000000000001');
insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,created_by) values
 ('17296000-0000-4000-8000-000000000020','16896000-0000-4000-8000-000000000002','2026-10-27 12:00Z','2026-10-27 13:00Z','America/Sao_Paulo','regular','16896000-0000-4000-8000-000000000001');
insert into pcm.visita_ordens_servico(id,visita_id,os_id,cliente_id,sequencia,estimativa_minutos,created_by) values
 ('17296000-0000-4000-8000-000000000030','17296000-0000-4000-8000-000000000020','16896000-0000-4000-8000-000000000017','16896000-0000-4000-8000-000000000002',1,60,'16896000-0000-4000-8000-000000000001'),
 ('17296000-0000-4000-8000-000000000031','17296000-0000-4000-8000-000000000020','17296000-0000-4000-8000-000000000021','16896000-0000-4000-8000-000000000002',2,120,'16896000-0000-4000-8000-000000000001');
set local role authenticated;
select is((select vinculo_id from pcm.sso_fontes_demanda_autorizadas('16896000-0000-4000-8000-000000000002','2026-10-26',null,1)),'17296000-0000-4000-8000-000000000030'::uuid,'primeira página retorna vínculo real');
select is((select vinculo_id from pcm.sso_fontes_demanda_autorizadas('16896000-0000-4000-8000-000000000002','2026-10-26','17296000-0000-4000-8000-000000000030',1)),'17296000-0000-4000-8000-000000000031'::uuid,'cursor retorna próximo vínculo');
select is((select completude from pcm.sso_fontes_demanda_autorizadas('16896000-0000-4000-8000-000000000002','2026-10-26',null,1)),'desconhecida','fonte não afirma completude');
select throws_ok($$select * from pcm.sso_fontes_demanda_autorizadas('16895000-0000-4000-8000-000000000002','2026-10-26',null,50)$$,'42501','capacidade_nao_encontrada_ou_sem_acesso','Cliente sem concessão negado');
select throws_ok($$select * from pcm.sso_fontes_demanda_autorizadas('16896000-0000-4000-8000-000000000002','2026-10-27',null,50)$$,'22023','consulta_invalida','fonte rejeita semana inválida');
reset role;
update config.sso_concessoes set ativa=false where usuario_id='16896000-0000-4000-8000-000000000001' and acao='capacidade.gerir';
set local role authenticated;
select throws_ok($$select * from pcm.sso_fontes_demanda_autorizadas('16896000-0000-4000-8000-000000000002','2026-10-26',null,50)$$,'42501','capacidade_nao_encontrada_ou_sem_acesso','revogação nega leitura');
reset role;
select * from finish();
rollback;
