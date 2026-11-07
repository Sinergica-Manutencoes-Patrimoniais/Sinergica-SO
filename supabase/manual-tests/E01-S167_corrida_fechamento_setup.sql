-- Somente cluster descartável privado, schema restaurado sem dados e gates fechados.
begin;
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16796000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-corrida@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16796000-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values ('16796000-0000-4000-8000-00000000000a','Cliente A','16796000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16796000-0000-4000-8000-000000000001','chamado.encerrar','16796000-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values ('16796000-0000-4000-8000-000000000011','CH-S167-CORRIDA','16796000-0000-4000-8000-00000000000a','Chamado A','16796000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,created_by,chamado_id) values ('16796000-0000-4000-8000-000000000022','16796000-0000-4000-8000-00000000000a','OS-S167-CORRIDA','OS legada','corretiva','finalizado','16796000-0000-4000-8000-000000000001',null);
update pcm.chamados set ordem_servico_id='16796000-0000-4000-8000-000000000022' where id='16796000-0000-4000-8000-000000000011';
insert into pcm.chamado_escopo_composicoes(chamado_id,declarada_completa) values ('16796000-0000-4000-8000-000000000011',true);
insert into pcm.chamado_escopo_parcelas(id,chamado_id,descricao,situacao,created_by,os_atendimento_id) values ('16796000-0000-4000-8000-000000000031','16796000-0000-4000-8000-000000000011','Parcela','atendida','16796000-0000-4000-8000-000000000001','16796000-0000-4000-8000-000000000022');
commit;
