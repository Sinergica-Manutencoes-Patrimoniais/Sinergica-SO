begin;
\ir E01-S172_snapshot_capacidade_fixture.sql
select plan(13);
select ok(has_function_privilege('authenticated','pcm.sso_snapshot_capacidade_autorizado(uuid,date,integer)','execute'),'mediador acessível');
select ok(not has_function_privilege('authenticated','pcm.sso_os_sem_visita_capacidade(uuid,date)','execute'),'fonte interna privada');
select throws_ok($$select pcm.sso_snapshot_capacidade_autorizado(null,null,2)$$,'55000','esforco_capacidade_bloqueado','gates preservados');
select is((select provolatile::text from pg_proc where oid='pcm.sso_mediar_snapshot_capacidade_v2(uuid,date)'::regprocedure),'s','snapshot combinado estável');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('16896000-0000-4000-8000-000000000001','capacidade.gerir','16896000-0000-4000-8000-000000000002'),
 ('16896000-0000-4000-8000-000000000001','plano.gerir','16896000-0000-4000-8000-000000000002');
insert into pcm.plano_versoes(id,plano_id,numero,estado,snapshot,created_by) values ('17296000-0000-4000-8000-000000000091','16896000-0000-4000-8000-000000000007',2,'aprovado','{"fuso_plano":{"fuso":"America/Sao_Paulo"},"rotinas":[{"id":"17296000-0000-4000-8000-000000000092","rotina_logica_id":"17296000-0000-4000-8000-000000000093","modo":"calendario","alvo_tipo":"sistema","sistema_id":"16896000-0000-4000-8000-000000000020"}]}'::jsonb,'16896000-0000-4000-8000-000000000001');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,created_by) values ('17296000-0000-4000-8000-000000000092','17296000-0000-4000-8000-000000000093','16896000-0000-4000-8000-000000000007','17296000-0000-4000-8000-000000000091','Rotina sintética','sistema','16896000-0000-4000-8000-000000000020','calendario','16896000-0000-4000-8000-000000000001');
insert into pcm.ocorrencias_preventivas(id,plano_id,indice,vencimento,chave_externa) values ('17296000-0000-4000-8000-000000000094','16896000-0000-4000-8000-000000000013',1,'2026-01-02','s172-fuso-fixture');
insert into pcm.ocorrencias_rotina_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,ciclo,vencimento_original,tolerancia_antes,tolerancia_depois,created_by) values ('17296000-0000-4000-8000-000000000095','16896000-0000-4000-8000-000000000007','17296000-0000-4000-8000-000000000091','17296000-0000-4000-8000-000000000092','17296000-0000-4000-8000-000000000093','sistema','16896000-0000-4000-8000-000000000020',1,'2026-01-02',0,0,'16896000-0000-4000-8000-000000000001');
insert into pcm.ciclos_rotina_identidades(id,rotina_logica_id,alvo_tipo,alvo_id,created_by) values ('17296000-0000-4000-8000-000000000096','17296000-0000-4000-8000-000000000093','sistema','16896000-0000-4000-8000-000000000020','16896000-0000-4000-8000-000000000001');
insert into pcm.ocorrencias_rotina_vinculos(ocorrencia_preparada_id,ciclo_id,ocorrencia_legada_id,created_by) values ('17296000-0000-4000-8000-000000000095','17296000-0000-4000-8000-000000000096','17296000-0000-4000-8000-000000000094','16896000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,prioridade,origem,created_by,ocorrencia_preventiva_id,data_agendada) values
 ('17296000-0000-4000-8000-000000000097','16896000-0000-4000-8000-000000000002','OS-S172-FUSO','OS fuso','preventiva','em_execucao','media','manual','16896000-0000-4000-8000-000000000001','17296000-0000-4000-8000-000000000094','2026-01-05 01:00Z'),
 ('17296000-0000-4000-8000-000000000098','16896000-0000-4000-8000-000000000002','OS-S172-SEM-FUSO','OS sem fuso','preventiva','em_execucao','media','manual','16896000-0000-4000-8000-000000000001',null,'2026-01-02 12:00Z'),
 ('17296000-0000-4000-8000-000000000099','16896000-0000-4000-8000-000000000002','OS-S172-SEM-DATA','OS sem data','preventiva','em_execucao','media','manual','16896000-0000-4000-8000-000000000001',null,null);
update pcm.capacidade_esforco_declarado_gate set habilitado=true where id;
update pcm.capacidade_fontes_mediacao_gate set habilitado=true where id;
update pcm.capacidade_demanda_gate set habilitado=true where id;
update pcm.sso_fila_obrigacoes_preparadas_gate set habilitado=true where id;
update pcm.sso_origem_execucao_unificada_gate set habilitado=true where id;
set local request.jwt.claims = '{"sub":"16896000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is(jsonb_array_length(pcm.sso_snapshot_capacidade_autorizado('16896000-0000-4000-8000-000000000002','2025-12-29',2)->'osSemVisita'),2,'OS com agendamento e OS pelo vencimento incluídas');
select is(pcm.sso_snapshot_capacidade_autorizado('16896000-0000-4000-8000-000000000002','2025-12-29',2)->>'pendentesSemSemana','2','OS sem fuso ou data não são atribuídas a semana');
select is((select x->>'data_referencia' from jsonb_array_elements(pcm.sso_snapshot_capacidade_autorizado('16896000-0000-4000-8000-000000000002','2025-12-29',2)->'osSemVisita') x where x->>'os_id'='17296000-0000-4000-8000-000000000097'),'2026-01-04','fuso preserva domingo na virada semanal UTC');
select is((select x->>'data_referencia' from jsonb_array_elements(pcm.sso_snapshot_capacidade_autorizado('16896000-0000-4000-8000-000000000002','2025-12-29',2)->'osSemVisita') x where x->>'os_id'='16896000-0000-4000-8000-000000000017'),'2026-01-01','OS sem agendamento usa vencimento original');
select is((select x->>'os_status' from jsonb_array_elements(pcm.sso_snapshot_capacidade_autorizado('16896000-0000-4000-8000-000000000002','2025-12-29',2)->'osSemVisita') x where x->>'os_id'='17296000-0000-4000-8000-000000000097'),'em_execucao','status atual é exposto sem inferir execução');
select is(pcm.sso_snapshot_capacidade_autorizado('16896000-0000-4000-8000-000000000002','2025-12-29',2)->>'completude','desconhecida','snapshot continua incompleto');
select throws_ok($$select pcm.sso_snapshot_capacidade_autorizado('16895000-0000-4000-8000-000000000002','2025-12-29',2)$$,'42501','capacidade_nao_encontrada_ou_sem_acesso','outro Cliente negado');
reset role;
update pcm.sso_origem_execucao_unificada_gate set habilitado=false where id;
set local role authenticated;
select is(pcm.sso_snapshot_capacidade_autorizado('16896000-0000-4000-8000-000000000002','2025-12-29',2)->>'pendentesSemSemana','3','gate do resolvedor fechado impede inferir semana');
reset role;
update pcm.sso_origem_execucao_unificada_gate set habilitado=true where id;
update config.sso_concessoes set ativa=false where usuario_id='16896000-0000-4000-8000-000000000001' and acao='execucao.validar';
set local role authenticated;
select is(pcm.sso_snapshot_capacidade_autorizado('16896000-0000-4000-8000-000000000002','2025-12-29',2)->>'pendentesSemSemana','3','revogação do resolvedor impede inferir semana');
reset role;
select * from finish();
rollback;
