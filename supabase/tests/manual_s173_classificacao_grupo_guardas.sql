-- Teste manual no banco diagnóstico descartável: usa fixtures 17370000/17380000 do experimento.
-- Nenhum evento externo é recebido; toda alteração abaixo é revertida.
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(3);
update pcm.origem_campo_inbox_gate set habilitado=true where id;
update pcm.validacao_os_gate set habilitado=true where id;
update pcm.sso_coordenacao_grupo_retorno_gate set habilitado=true where id;
update pcm.clientes set auvo_id=17370001 where id='17370000-0000-4000-8000-000000000002';
update pcm.clientes set auvo_id=17380001 where id='17380000-0000-4000-8000-000000000002';
update pcm.ordens_servico set auvo_task_id=17380002 where id='17380000-0000-4000-8000-000000000014';
insert into pcm.planos_manutencao(id,cliente_id,nome,created_by) values ('17370000-0000-4000-8000-000000000024','17370000-0000-4000-8000-000000000002','Plano teste classificação','17370000-0000-4000-8000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,snapshot,created_by) values ('17370000-0000-4000-8000-000000000025','17370000-0000-4000-8000-000000000024',1,'aprovado','{"rotinas":[{"id":"17370000-0000-4000-8000-000000000026","alvo_tipo":"grupo","grupo_id":"17370000-0000-4000-8000-000000000006","questionario":{"perguntas":[{"id":"p1"}]}}]}'::jsonb,'17370000-0000-4000-8000-000000000001');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,grupo_id,modo,created_by) values ('17370000-0000-4000-8000-000000000026','17370000-0000-4000-8000-000000000027','17370000-0000-4000-8000-000000000024','17370000-0000-4000-8000-000000000025','Rotina classificação','grupo','17370000-0000-4000-8000-000000000006','calendario','17370000-0000-4000-8000-000000000001');
insert into pcm.ocorrencias_rotina_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,ciclo,vencimento_original,tolerancia_antes,tolerancia_depois,created_by) values ('17370000-0000-4000-8000-000000000028','17370000-0000-4000-8000-000000000024','17370000-0000-4000-8000-000000000025','17370000-0000-4000-8000-000000000026','17370000-0000-4000-8000-000000000027','grupo','17370000-0000-4000-8000-000000000006',0,'2026-01-01',0,0,'17370000-0000-4000-8000-000000000001');
insert into pcm.sso_ocorrencias_grupo(id,request_id,cliente_id,plano_id,versao_id,rotina_id,grupo_id,calendario_preparado_id,vencimento_original,grupo_revisao,quantidade_snapshot,ator_id,payload) values ('17370000-0000-4000-8000-000000000029','17370000-0000-4000-8000-000000000030','17370000-0000-4000-8000-000000000002','17370000-0000-4000-8000-000000000024','17370000-0000-4000-8000-000000000025','17370000-0000-4000-8000-000000000026','17370000-0000-4000-8000-000000000006','17370000-0000-4000-8000-000000000028','2026-01-01',1,10,'17370000-0000-4000-8000-000000000001','{}');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,prioridade,origem,created_by,auvo_task_id) values ('17370000-0000-4000-8000-000000000031','17370000-0000-4000-8000-000000000002','OS-S173-RPC-TESTE','OS sintética','corretiva','solicitacao','media','manual','17370000-0000-4000-8000-000000000001',17370002);
insert into pcm.sso_vinculos_os_grupo(request_id,cliente_id,ocorrencia_grupo_id,os_id,motivo,ator_id,payload) values ('17370000-0000-4000-8000-000000000032','17370000-0000-4000-8000-000000000002','17370000-0000-4000-8000-000000000029','17370000-0000-4000-8000-000000000031','Fixture','17370000-0000-4000-8000-000000000001','{}');
insert into pcm.origem_campo_inbox(id,integracao,task_id,chave_evento,cliente_externo_id,payload) values
 ('17370000-0000-4000-8000-000000000020','auvo',17370002,'s173-sintetico-vinculo','17370001','{}'),
 ('17380000-0000-4000-8000-000000000020','auvo',17380002,'s173-sintetico-sem-vinculo','17380001','{}');
insert into pcm.origem_campo_resolucoes(id,envelope_id,cliente_id,os_id,resultado) values
 ('17370000-0000-4000-8000-000000000021','17370000-0000-4000-8000-000000000020','17370000-0000-4000-8000-000000000002','17370000-0000-4000-8000-000000000031','os_identificada'),
 ('17380000-0000-4000-8000-000000000021','17380000-0000-4000-8000-000000000020','17380000-0000-4000-8000-000000000002','17380000-0000-4000-8000-000000000014','os_identificada');
set local request.jwt.claims='{"sub":"17370000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select throws_ok($$select pcm.sso_classificar_retorno_campo_manual('17370000-0000-4000-8000-000000000022','17370000-0000-4000-8000-000000000002','17370000-0000-4000-8000-000000000020','17370000-0000-4000-8000-000000000021','17370000-0000-4000-8000-000000000023','[{"perguntaId":"p1","resultado":"ok"}]')$$,'55000','origem_consumidores_nao_integrados','Grupo com vínculo continua bloqueado na RPC real');
set local request.jwt.claims='{"sub":"17380000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select throws_ok($$select pcm.sso_classificar_retorno_campo_manual('17380000-0000-4000-8000-000000000022','17380000-0000-4000-8000-000000000002','17380000-0000-4000-8000-000000000020','17380000-0000-4000-8000-000000000021','17380000-0000-4000-8000-000000000023','[{"perguntaId":"p1","resultado":"ok"}]')$$,'23514','vinculo_ocorrencia_nao_comprovado','OS sem origem comprovada não é classificada');
select ok(not exists(select 1 from pcm.retorno_os_preparado where id in ('17370000-0000-4000-8000-000000000023','17380000-0000-4000-8000-000000000023')),'recusas não geram retornos');
select * from finish();
rollback;
