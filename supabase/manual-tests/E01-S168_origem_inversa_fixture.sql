-- Somente clone sintético descartável com E01-S168_opcional_concorrencia_fixture.sql aplicado.
begin;
set local app.auvo_sync_write='true';
insert into pcm.ocorrencias_preventivas(id,plano_id,indice,vencimento,chave_externa) values ('16891000-0000-4000-8000-000000000071','16891000-0000-4000-8000-000000000013',2,'2026-03-01','s168-origem-inversa');
insert into pcm.ocorrencias_rotina_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,ciclo,vencimento_original,tolerancia_antes,tolerancia_depois,created_by) select '16891000-0000-4000-8000-000000000072',plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,2,'2026-03-01',0,0,created_by from pcm.ocorrencias_rotina_preparadas where id='16891000-0000-4000-8000-000000000015';
insert into pcm.ciclos_rotina_identidades(id,rotina_logica_id,alvo_tipo,alvo_id,created_by) select '16891000-0000-4000-8000-000000000073',rotina_logica_id,alvo_tipo,alvo_id,created_by from pcm.ciclos_rotina_identidades where id='16891000-0000-4000-8000-000000000016';
insert into pcm.ocorrencias_rotina_vinculos(ocorrencia_preparada_id,ciclo_id,ocorrencia_legada_id,created_by) values ('16891000-0000-4000-8000-000000000072','16891000-0000-4000-8000-000000000073','16891000-0000-4000-8000-000000000071','16891000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,prioridade,origem,created_by,ocorrencia_preventiva_id,auvo_task_id) values ('16891000-0000-4000-8000-000000000074','16891000-0000-4000-8000-000000000002','OS-S168-INVERSA','OS sintética','preventiva','em_execucao','media','manual','16891000-0000-4000-8000-000000000001','16891000-0000-4000-8000-000000000071',168910004);
insert into pcm.origem_campo_inbox(id,integracao,task_id,chave_evento,cliente_externo_id,payload) values ('16891000-0000-4000-8000-000000000075','auvo',168910004,'s168-race-inversa','168910001','{}');
insert into pcm.origem_campo_resolucoes(id,envelope_id,cliente_id,os_id,resultado) values ('16891000-0000-4000-8000-000000000076','16891000-0000-4000-8000-000000000075','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000074','os_identificada');
commit;
