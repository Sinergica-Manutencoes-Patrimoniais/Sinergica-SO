begin;
\ir E01-S168_finalizacao_fixture_real.sql
select plan(9);
select ok(has_function_privilege('authenticated','pcm.sso_snapshot_capacidade_autorizado(uuid,date,integer)','execute'),'snapshot v3 mediado disponível');
select ok(not has_function_privilege('authenticated','pcm.sso_finalizar_os_validada_v2(uuid,uuid,uuid,uuid,uuid,integer,text,timestamptz)','execute'),'finalização interna permanece privada');
select throws_ok($$select pcm.sso_snapshot_capacidade_autorizado(null,null,3)$$,'55000','esforco_capacidade_bloqueado','gates do snapshot continuam necessários');
select is((select provolatile::text from pg_proc where oid='pcm.sso_mediar_snapshot_capacidade_v3(uuid,date)'::regprocedure),'s','provas e fontes usam mesmo snapshot de instrução');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('16891000-0000-4000-8000-000000000001','capacidade.gerir','16891000-0000-4000-8000-000000000002'),
 ('16891000-0000-4000-8000-000000000001','plano.gerir','16891000-0000-4000-8000-000000000002');
insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,created_by) values
 ('17296000-0000-4000-8000-000000000101','16891000-0000-4000-8000-000000000002','2026-01-02 12:00Z','2026-01-02 13:00Z','America/Sao_Paulo','regular','16891000-0000-4000-8000-000000000001');
insert into pcm.visita_ordens_servico(id,visita_id,os_id,cliente_id,sequencia,estimativa_minutos,created_by) values
 ('17296000-0000-4000-8000-000000000102','17296000-0000-4000-8000-000000000101','16891000-0000-4000-8000-000000000017','16891000-0000-4000-8000-000000000002',1,60,'16891000-0000-4000-8000-000000000001');
update pcm.capacidade_esforco_declarado_gate set habilitado=true where id;
update pcm.capacidade_fontes_mediacao_gate set habilitado=true where id;
update pcm.capacidade_demanda_gate set habilitado=true where id;
update pcm.sso_fila_obrigacoes_preparadas_gate set habilitado=true where id;
set local app.auvo_sync_write='true';
set local request.jwt.claims = '{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is(pcm.sso_snapshot_capacidade_autorizado('16891000-0000-4000-8000-000000000002','2025-12-29',3)->'fontesVisita'->0->>'prova_finalizacao_pcm','indisponivel','gate fechado não expõe histórico');
reset role;
update pcm.sso_mediacao_finalizacao_os_gate set habilitado=true where id;
update pcm.sso_finalizar_os_validada_gate set habilitado=true where id;
update pcm.sso_atestacao_pcm_gate set habilitado=true where id;
update pcm.validacao_os_gate set habilitado=true where id;
update pcm.sso_upload_evidencia_resposta_gate set habilitado=true where id;
update pcm.sso_validacao_resposta_gate set habilitado=true where id;
set local role authenticated;
select is(pcm.sso_mediar_finalizacao_os('17296000-0000-4000-8000-000000000103','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000017','16891000-0000-4000-8000-000000000034',1,'em_execucao','2026-10-01T10:00:00Z')->>'status','finalizado','finalização sintética validada');
select is(pcm.sso_snapshot_capacidade_autorizado('16891000-0000-4000-8000-000000000002','2025-12-29',3)->'fontesVisita'->0->>'prova_finalizacao_pcm','finalizacao_pcm_registrada','histórico coerente é indicado sem inferir ocorrência');
reset role;
update pcm.sso_mediacao_finalizacao_os_gate set habilitado=false where id;
set local role authenticated;
select is(pcm.sso_snapshot_capacidade_autorizado('16891000-0000-4000-8000-000000000002','2025-12-29',3)->'fontesVisita'->0->>'prova_finalizacao_pcm','indisponivel','gate fechado oculta prova');
reset role;
update pcm.sso_mediacao_finalizacao_os_gate set habilitado=true where id;
update config.sso_concessoes set ativa=false where usuario_id='16891000-0000-4000-8000-000000000001' and acao='execucao.validar';
set local role authenticated;
select is(pcm.sso_snapshot_capacidade_autorizado('16891000-0000-4000-8000-000000000002','2025-12-29',3)->'fontesVisita'->0->>'prova_finalizacao_pcm','indisponivel','revogação oculta prova');
reset role;
select * from finish();
rollback;
