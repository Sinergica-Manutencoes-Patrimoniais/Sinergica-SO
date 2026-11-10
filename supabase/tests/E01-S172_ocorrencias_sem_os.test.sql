begin;
\ir E01-S172_snapshot_capacidade_fixture.sql
select plan(10);
select ok(has_function_privilege('authenticated','pcm.sso_ocorrencias_sem_os_autorizadas(uuid,date,text,uuid,integer)','execute'),'projeção acessível por mediador');
select ok(not has_table_privilege('authenticated','pcm.ocorrencias_rotina_preparadas','SELECT'),'ocorrência preparada continua privada');
select throws_ok($$select * from pcm.sso_ocorrencias_sem_os_autorizadas(null,null,null,null,50)$$,'55000','ocorrencias_capacidade_bloqueadas','gate da fila é obrigatório');
select ok(not has_table_privilege('authenticated','pcm.capacidade_esforco_declaracoes','SELECT'),'declaração continua privada');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('16896000-0000-4000-8000-000000000001','capacidade.gerir','16896000-0000-4000-8000-000000000002'),
 ('16896000-0000-4000-8000-000000000001','plano.gerir','16896000-0000-4000-8000-000000000002');
insert into pcm.ocorrencias_rotina_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,ciclo,vencimento_original,tolerancia_antes,tolerancia_depois,created_by)
 values('17296000-0000-4000-8000-000000000070','16896000-0000-4000-8000-000000000007','16896000-0000-4000-8000-000000000008','16896000-0000-4000-8000-000000000009','16896000-0000-4000-8000-000000000010','grupo','16896000-0000-4000-8000-000000000006',1,'2026-01-02',0,0,'16896000-0000-4000-8000-000000000001');
update pcm.sso_fila_obrigacoes_preparadas_gate set habilitado=true where id;
update pcm.capacidade_esforco_declarado_gate set habilitado=true where id;
set local request.jwt.claims = '{"sub":"16896000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select is(pcm.sso_declarar_esforco_capacidade('17296000-0000-4000-8000-000000000071','16896000-0000-4000-8000-000000000002','ocorrencia','17296000-0000-4000-8000-000000000070',0,null,120,30,'declarado')->>'revision','1','esforço da ocorrência declarado');
set local role authenticated;
select is((select count(*) from pcm.sso_ocorrencias_sem_os_autorizadas('16896000-0000-4000-8000-000000000002','2025-12-29',null,null,50)),1::bigint,'ocorrência ligada a OS é excluída');
select is((select terceiros_minutos from pcm.sso_ocorrencias_sem_os_autorizadas('16896000-0000-4000-8000-000000000002','2025-12-29',null,null,50)),120,'terceiros preservados');
select is((select internos_minutos from pcm.sso_ocorrencias_sem_os_autorizadas('16896000-0000-4000-8000-000000000002','2025-12-29',null,null,50)),null::integer,'ausência não vira zero');
select is((select completude from pcm.sso_ocorrencias_sem_os_autorizadas('16896000-0000-4000-8000-000000000002','2025-12-29',null,null,50)),'desconhecida','estado permanece desconhecido');
select throws_ok($$select * from pcm.sso_ocorrencias_sem_os_autorizadas('16895000-0000-4000-8000-000000000002','2025-12-29',null,null,50)$$,'42501','sem_acesso','outro Cliente negado');
reset role;
select * from finish();
rollback;
