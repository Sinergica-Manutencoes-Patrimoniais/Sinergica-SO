-- Apenas para banco descartável; fixtures persistentes sintéticas para teste em duas sessões.
-- IDs 17799500-* e código S177-RACE-*; não executar em banco com dados reais.
-- No diagnóstico também foram persistidos Sistemas finais 0012/0013 e OS 0021/0022/0023;
-- Componente 0014 é sintético. As OS 0024 e o ID externo fictício de sync foram revertidos.
begin;
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('17799500-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s177-race-0995@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17799500-0000-0000-0000-000000000001','superadmin','S177 corrida sintética',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('17799500-0000-0000-0000-00000000000a','S177 corrida sintética',true,'17799500-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('17799500-0000-0000-0000-000000000001','cadastro.gerir','17799500-0000-0000-0000-00000000000a');
insert into pcm.sistemas(id,cliente_id,nome,codigo) values ('17799500-0000-0000-0000-000000000011','17799500-0000-0000-0000-00000000000a','S177 corrida sintética','S177-RACE-OLD-0995');
insert into pcm.sso_codigo_ciclo(tipo,ativo_id,cliente_id) values ('sistema','17799500-0000-0000-0000-000000000011','17799500-0000-0000-0000-00000000000a');
insert into pcm.equipamentos(id,client_id,nome,identificador) values ('17799500-0000-0000-0000-000000000014','17799500-0000-0000-0000-00000000000a','S177 componente sintético','S177-COMP-OLD-0995');
insert into pcm.sso_codigo_ciclo(tipo,ativo_id,cliente_id) values ('componente','17799500-0000-0000-0000-000000000014','17799500-0000-0000-0000-00000000000a');
commit;
