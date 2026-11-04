-- Exclusivamente cópia sintética sso_s167_concorrencia sem rede e com cron desligado.
-- Remove restrições somente nesta cópia para ensaiar o núcleo 1:N; não é migration.
\set ON_ERROR_STOP on
do $$ begin
  if current_database() <> 'sso_s167_concorrencia' or current_setting('cron.launch_active_jobs') <> 'off' then
    raise exception 'ambiente_inadequado';
  end if;
end $$;
begin;
set local app.auvo_sync_write='true';
drop index pcm.uq_ordens_servico_chamado;
drop trigger trg_ordens_servico_numero_chamado on pcm.ordens_servico;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16710000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','concorrencia-s167@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16710000-0000-4000-8000-000000000001','superadmin','Teste concorrente',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('16710000-0000-4000-8000-00000000000a','Cliente teste',true,'16710000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16710000-0000-4000-8000-000000000001','chamado.os.criar','16710000-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,origem,status,created_by) values ('16710000-0000-4000-8000-000000000011','CH-TESTE-167-CONC','16710000-0000-4000-8000-00000000000a','Chamado teste','manual','aberto','16710000-0000-4000-8000-000000000001');
update pcm.sso_criacao_os_mediada_gate set habilitado=true where id;
update pcm.chamado_os_gate set habilitado=true where id;
commit;
