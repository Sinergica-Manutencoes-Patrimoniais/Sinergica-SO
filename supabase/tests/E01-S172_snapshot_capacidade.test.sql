begin;
\ir E01-S172_snapshot_capacidade_fixture.sql
select plan(13);
select ok(has_function_privilege('authenticated','pcm.sso_snapshot_capacidade_autorizado(uuid,date,integer)','execute'),'snapshot mediado acessível');
select ok(not has_function_privilege('anon','pcm.sso_snapshot_capacidade_autorizado(uuid,date,integer)','execute'),'anônimo não consulta');
select throws_ok($$select pcm.sso_snapshot_capacidade_autorizado(null,null,1)$$,'55000','esforco_capacidade_bloqueado','gate de esforço obrigatório');
select ok(not has_table_privilege('authenticated','pcm.capacidade_esforco_declaracoes','SELECT'),'fonte continua privada');
select is((select provolatile::text from pg_proc where oid='pcm.sso_mediar_snapshot_capacidade(uuid,date)'::regprocedure),'s','leitura combinada usa snapshot de instrução estável');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('16896000-0000-4000-8000-000000000001','capacidade.gerir','16896000-0000-4000-8000-000000000002'),
 ('16896000-0000-4000-8000-000000000001','plano.gerir','16896000-0000-4000-8000-000000000002');
insert into pcm.ocorrencias_rotina_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,ciclo,vencimento_original,tolerancia_antes,tolerancia_depois,created_by)
 values('17296000-0000-4000-8000-000000000080','16896000-0000-4000-8000-000000000007','16896000-0000-4000-8000-000000000008','16896000-0000-4000-8000-000000000009','16896000-0000-4000-8000-000000000010','grupo','16896000-0000-4000-8000-000000000006',1,'2026-01-02',0,0,'16896000-0000-4000-8000-000000000001');
insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,created_by) values
 ('17296000-0000-4000-8000-000000000081','16896000-0000-4000-8000-000000000002','2026-01-02 12:00Z','2026-01-02 13:00Z','America/Sao_Paulo','regular','16896000-0000-4000-8000-000000000001');
insert into pcm.visita_ordens_servico(id,visita_id,os_id,cliente_id,sequencia,estimativa_minutos,created_by) values
 ('17296000-0000-4000-8000-000000000082','17296000-0000-4000-8000-000000000081','16896000-0000-4000-8000-000000000017','16896000-0000-4000-8000-000000000002',1,60,'16896000-0000-4000-8000-000000000001');
update pcm.capacidade_esforco_declarado_gate set habilitado=true where id;
update pcm.capacidade_fontes_mediacao_gate set habilitado=true where id;
update pcm.capacidade_demanda_gate set habilitado=true where id;
update pcm.sso_fila_obrigacoes_preparadas_gate set habilitado=true where id;
set local request.jwt.claims = '{"sub":"16896000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select is(pcm.sso_declarar_esforco_capacidade('17296000-0000-4000-8000-000000000083','16896000-0000-4000-8000-000000000002','os','16896000-0000-4000-8000-000000000017',0,60,120,30,'declarado')->>'revision','1','OS tem esforço declarado');
select is(pcm.sso_declarar_esforco_capacidade('17296000-0000-4000-8000-000000000084','16896000-0000-4000-8000-000000000002','ocorrencia','17296000-0000-4000-8000-000000000080',0,30,60,15,'declarado')->>'revision','1','ocorrência tem esforço declarado');
set local role authenticated;
select is(jsonb_array_length(pcm.sso_snapshot_capacidade_autorizado('16896000-0000-4000-8000-000000000002','2025-12-29',1)->'fontesVisita'),1,'OS de Visita aparece uma vez');
select is(jsonb_array_length(pcm.sso_snapshot_capacidade_autorizado('16896000-0000-4000-8000-000000000002','2025-12-29',1)->'ocorrenciasSemOs'),1,'ocorrência vinculada a OS não é contada novamente');
select is(pcm.sso_snapshot_capacidade_autorizado('16896000-0000-4000-8000-000000000002','2025-12-29',1)->'fontesVisita'->0->>'terceiros_minutos','120','terceiros permanecem separados');
select is(pcm.sso_snapshot_capacidade_autorizado('16896000-0000-4000-8000-000000000002','2025-12-29',1)->>'completude','desconhecida','não afirma completude');
select throws_ok($$select pcm.sso_snapshot_capacidade_autorizado('16895000-0000-4000-8000-000000000002','2025-12-29',1)$$,'42501','capacidade_nao_encontrada_ou_sem_acesso','Cliente sem concessão negado');
select is(pcm.sso_snapshot_capacidade_autorizado('16896000-0000-4000-8000-000000000002','2025-12-29',1)->>'limiteFontesAtingido','false','página pequena não atinge limite');
reset role;
select * from finish();
rollback;
