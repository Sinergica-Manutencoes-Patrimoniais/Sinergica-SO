-- Somente em clone descartável; estas linhas precisam ser visíveis nas duas sessões.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('16750000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fixture-1675@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into pcm.clientes(id,nome,ativo,created_by) values ('16750000-0000-4000-8000-000000000002','Cliente 1675',true,'16750000-0000-4000-8000-000000000001');
insert into pcm.sistemas(id,cliente_id,nome) values ('16750000-0000-4000-8000-000000000003','16750000-0000-4000-8000-000000000002','Sistema 1675');
insert into pcm.questionarios(id,auvo_id,nome,perguntas) values ('16750000-0000-4000-8000-000000000004',16750001,'Questionário 1675','[]');
insert into pcm.tipos_tarefa(id,nome) values ('16750000-0000-4000-8000-000000000005','Tarefa 1675');
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by)
select p.id,'16750000-0000-4000-8000-000000000002','16750000-0000-4000-8000-000000000003','16750000-0000-4000-8000-000000000004','16750000-0000-4000-8000-000000000005','Plano 1675',current_date,'meses',1,'ativo','16750000-0000-4000-8000-000000000001' from (values ('16750000-0000-4000-8000-000000000011'::uuid),('16750000-0000-4000-8000-000000000012'::uuid)) p(id);
