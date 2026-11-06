-- Base descartável; transação revertida. Nenhuma chamada Auvo.
begin;
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16795000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-multiplas@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16795000-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values ('16795000-0000-4000-8000-00000000000a','Cliente sintético','16795000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16795000-0000-4000-8000-000000000001','chamado.os.criar','16795000-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values ('16795000-0000-4000-8000-000000000011','CH-S167-MULTI','16795000-0000-4000-8000-00000000000a','Chamado sintético','16795000-0000-4000-8000-000000000001');
select set_config('request.jwt.claims','{"sub":"16795000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
update pcm.chamado_os_gate set habilitado=true where id;
select pcm.sso_criar_os_chamado('16795000-0000-4000-8000-000000000031',1,'16795000-0000-4000-8000-000000000011','16795000-0000-4000-8000-00000000000a','16795000-0000-4000-8000-000000000021','OS 1',null,'corretiva');
select pcm.sso_criar_os_chamado('16795000-0000-4000-8000-000000000031',1,'16795000-0000-4000-8000-000000000011','16795000-0000-4000-8000-00000000000a','16795000-0000-4000-8000-000000000021','OS 1',null,'corretiva');
select pcm.sso_criar_os_chamado('16795000-0000-4000-8000-000000000032',2,'16795000-0000-4000-8000-000000000011','16795000-0000-4000-8000-00000000000a','16795000-0000-4000-8000-000000000022','OS 2',null,'corretiva');
do $$ begin
 if (select count(*) from pcm.ordens_servico where chamado_id='16795000-0000-4000-8000-000000000011')<>2 then raise exception 'criacao_nao_idempotente'; end if;
 if (select count(distinct numero) from pcm.ordens_servico where chamado_id='16795000-0000-4000-8000-000000000011')<>2 then raise exception 'numero_duplicado'; end if;
 if exists(select 1 from pcm.auvo_sync_outbox where row_id in ('16795000-0000-4000-8000-000000000021','16795000-0000-4000-8000-000000000022')) then raise exception 'auvo_inesperado'; end if;
end $$;
rollback;
