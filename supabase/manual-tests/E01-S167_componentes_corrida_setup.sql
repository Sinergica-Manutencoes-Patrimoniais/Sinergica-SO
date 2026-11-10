-- SOMENTE clone descartável de schema, sem cron/net; fixtures sintéticas não devem ir para produção.
set app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16798111-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-corrida@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16798111-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values ('16798111-0000-4000-8000-00000000000a','Cliente A','16798111-0000-4000-8000-000000000001');
insert into config.sso_acoes(codigo,modulo,nivel,exige_concessao_individual) values ('chamado.os.criar','pcm','escrita',false) on conflict (codigo) do nothing;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16798111-0000-4000-8000-000000000001','chamado.os.criar','16798111-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values ('16798111-0000-4000-8000-000000000011','CH-S167-CORRIDA','16798111-0000-4000-8000-00000000000a','Chamado sintético','16798111-0000-4000-8000-000000000001');
insert into pcm.equipamentos(id,client_id,nome) values ('16798111-0000-4000-8000-000000000021','16798111-0000-4000-8000-00000000000a','Componente sintético');
insert into pcm.sso_conversao_integral_mediada_gate(id,habilitado) values(true,true);
grant usage on schema pcm to authenticated;
