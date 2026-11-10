-- SOMENTE banco de schema descartável, sem cron/net, rede externa ou dados reais.
set search_path=extensions,public;
set app.auvo_sync_write='true';
-- Clone sem ACLs: somente para satisfazer gatilhos/FKs do ensaio, não representa ACL real.
grant usage on schema auth to public;
grant select on auth.users to public;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16798200-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-tres@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()) on conflict(id) do nothing;
insert into config.usuarios(user_id,papel,nome,ativo) values ('16798200-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values ('16798200-0000-4000-8000-000000000002','Cliente sintético','16798200-0000-4000-8000-000000000001');
insert into config.sso_acoes(codigo,modulo,nivel,exige_concessao_individual) values ('chamado.os.criar','pcm','escrita',false) on conflict (codigo) do nothing;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16798200-0000-4000-8000-000000000001','chamado.os.criar','16798200-0000-4000-8000-000000000002');
insert into pcm.chamados(id,numero,cliente_id,titulo,descricao,created_by) values ('16798200-0000-4000-8000-000000000003','CH-S167-TRIPLA','16798200-0000-4000-8000-000000000002','Necessidade','Descrição','16798200-0000-4000-8000-000000000001');
insert into pcm.chamado_os_gate(id,habilitado) values(true,true);
insert into pcm.sso_conversao_integral_mediada_gate(id,habilitado) values(true,true);
drop index pcm.uq_ordens_servico_chamado;
drop trigger trg_ordens_servico_numero_chamado on pcm.ordens_servico;
revoke all on function pcm.sso_converter_chamado_integral(uuid,bigint,uuid,uuid,uuid,jsonb,text,text) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_converter_chamado_integral_autorizado(uuid,bigint,uuid,uuid,uuid,jsonb,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_converter_chamado_integral_autorizado(uuid,bigint,uuid,uuid,uuid,jsonb,text,text) to authenticated;
grant usage on schema pcm to authenticated;
