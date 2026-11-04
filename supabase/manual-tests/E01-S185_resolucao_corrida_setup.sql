-- Apenas cluster próprio descartável. Nenhum dado real, serviço externo ou gate aberto.
begin;
set local app.auvo_sync_write='true';
insert into config.sso_acoes(codigo,modulo,nivel,exige_concessao_individual) values ('integracao.reconciliar','pcm','escrita',false);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('18594000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s185-corrida@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('18594000-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values ('18594000-0000-4000-8000-00000000000a','Cliente A','18594000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('18594000-0000-4000-8000-000000000001','integracao.reconciliar','18594000-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values
 ('18594000-0000-4000-8000-000000000011','CH-S185-RACE-1','18594000-0000-4000-8000-00000000000a','Chamado A','18594000-0000-4000-8000-000000000001'),
 ('18594000-0000-4000-8000-000000000012','CH-S185-RACE-2','18594000-0000-4000-8000-00000000000a','Chamado B','18594000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,titulo,categoria,status,origem,created_by,chamado_id,auvo_task_id) values
 ('18594000-0000-4000-8000-000000000021','18594000-0000-4000-8000-00000000000a','OS A','corretiva','em_execucao','auvo','18594000-0000-4000-8000-000000000001','18594000-0000-4000-8000-000000000011',18594001),
 ('18594000-0000-4000-8000-000000000022','18594000-0000-4000-8000-00000000000a','OS B','corretiva','em_execucao','auvo','18594000-0000-4000-8000-000000000001','18594000-0000-4000-8000-000000000012',18594002);
insert into pcm.reconciliacao_webhook_chamado_conflitos(id,cliente_id,os_id,auvo_task_id,status_remoto) values
 ('18594000-0000-4000-8000-000000000031','18594000-0000-4000-8000-00000000000a','18594000-0000-4000-8000-000000000021',18594001,'em_execucao'),
 ('18594000-0000-4000-8000-000000000032','18594000-0000-4000-8000-00000000000a','18594000-0000-4000-8000-000000000022',18594002,'em_execucao');
commit;
