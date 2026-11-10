begin;
\ir E01-S172_snapshot_capacidade_fixture.sql
select plan(18);
select is((select count(*) from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id where o.id='16895000-0000-4000-8000-000000000015' and p.cliente_id='16895000-0000-4000-8000-000000000002'),1::bigint,'ocorrência do Cliente B existe');
select is((select count(*) from pcm.ordens_servico where id='16895000-0000-4000-8000-000000000017' and client_id='16895000-0000-4000-8000-000000000002'),1::bigint,'OS do Cliente B existe');
select has_table('pcm','capacidade_esforco_declaracoes','fonte declarada existe');
select ok(coalesce((select relrowsecurity and relforcerowsecurity from pg_class where oid=to_regclass('pcm.capacidade_esforco_declaracoes')),false),'RLS obrigatória');
select ok(coalesce(not has_table_privilege('authenticated',to_regclass('pcm.capacidade_esforco_declaracoes'),'INSERT'),false),'sem escrita direta');
select throws_ok($$select pcm.sso_declarar_esforco_capacidade(null,null,null,null,null,null,null,null,null)$$,'55000','esforco_capacidade_bloqueado','gate impede comando');
update pcm.capacidade_esforco_declarado_gate set habilitado=true where id;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('16896000-0000-4000-8000-000000000001','capacidade.gerir','16896000-0000-4000-8000-000000000002');
set local request.jwt.claims = '{"sub":"16896000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select is(pcm.sso_declarar_esforco_capacidade('17296000-0000-4000-8000-000000000001','16896000-0000-4000-8000-000000000002','os','16896000-0000-4000-8000-000000000017',0,60,120,30,'declarado')->>'revision','1','primeira declaração preserva componentes');
select is(pcm.sso_declarar_esforco_capacidade('17296000-0000-4000-8000-000000000001','16896000-0000-4000-8000-000000000002','os','16896000-0000-4000-8000-000000000017',0,60,120,30,'declarado')->>'revision','1','retry idêntico não duplica');
select throws_ok($$select pcm.sso_declarar_esforco_capacidade('17296000-0000-4000-8000-000000000001','16896000-0000-4000-8000-000000000002','os','16896000-0000-4000-8000-000000000017',0,61,120,30,'declarado')$$,'23505','request_id_conflitante','request divergente negado');
select throws_ok($$select pcm.sso_declarar_esforco_capacidade('17296000-0000-4000-8000-000000000002','16896000-0000-4000-8000-000000000002','os','16896000-0000-4000-8000-000000000017',0,0,0,0,'declarado')$$,'40001','revisao_obsoleta','revisão antiga negada');
select is(pcm.sso_declarar_esforco_capacidade('17296000-0000-4000-8000-000000000003','16896000-0000-4000-8000-000000000002','os','16896000-0000-4000-8000-000000000017',1,null,0,null,'pendente')->>'revision','2','ausência e zero permanecem explícitos');
select is((select internos_minutos from pcm.capacidade_esforco_declaracoes where request_id='17296000-0000-4000-8000-000000000003'),null::integer,'ausência não vira zero');
select throws_ok($$select pcm.sso_declarar_esforco_capacidade('17296000-0000-4000-8000-000000000004','16896000-0000-4000-8000-000000000002','os','16895000-0000-4000-8000-000000000017',0,60,0,0,'declarado')$$,'42501','sem_acesso','OS de outro Cliente negada');
select throws_ok($$update pcm.capacidade_esforco_declaracoes set internos_minutos=1 where request_id='17296000-0000-4000-8000-000000000001'$$,'23514',null,'histórico imutável');
select is(pcm.sso_declarar_esforco_capacidade('17296000-0000-4000-8000-000000000005','16896000-0000-4000-8000-000000000002','ocorrencia','16896000-0000-4000-8000-000000000015',0,null,120,30,'declarado')->>'revision','1','origem ocorrência existente');
select throws_ok($$select pcm.sso_declarar_esforco_capacidade('17296000-0000-4000-8000-000000000006','16896000-0000-4000-8000-000000000002','ocorrencia','16895000-0000-4000-8000-000000000015',0,60,0,0,'declarado')$$,'42501','sem_acesso','ocorrência de outro Cliente negada');
select is((select count(*) from audit.events where entity='capacidade_esforco_declaracoes' and entity_id='17296000-0000-4000-8000-000000000001'),1::bigint,'retry não duplica auditoria');
update config.sso_concessoes set ativa=false where usuario_id='16896000-0000-4000-8000-000000000001' and acao='capacidade.gerir';
select throws_ok($$select pcm.sso_declarar_esforco_capacidade('17296000-0000-4000-8000-000000000001','16896000-0000-4000-8000-000000000002','os','16896000-0000-4000-8000-000000000017',0,60,120,30,'declarado')$$,'42501','sem_acesso','revogação impede inclusive retry');
select * from finish();
rollback;
