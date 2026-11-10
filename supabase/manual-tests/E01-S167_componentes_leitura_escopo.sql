-- Diagnóstico somente: executar em banco isolado, sem rede externa; rollback integral.
begin;
set local app.auvo_sync_write='true';
set local search_path=extensions,public;
select plan(5);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16798001-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-leitura@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16798001-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values
('16798001-0000-4000-8000-00000000000a','Cliente A','16798001-0000-4000-8000-000000000001'),
('16798001-0000-4000-8000-00000000000b','Cliente B','16798001-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id)
values ('16798001-0000-4000-8000-000000000001','chamado.os.criar','16798001-0000-4000-8000-00000000000a');
insert into pcm.equipamentos(id,client_id,nome)
select ('16798002-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'16798001-0000-4000-8000-00000000000a','Componente ' || n
from generate_series(1,205) n;
insert into pcm.equipamentos(id,client_id,nome) values
('16798003-0000-4000-8000-000000000001','16798001-0000-4000-8000-00000000000b','Componente B');
set local role authenticated;
set local request.jwt.claims='{"sub":"16798001-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin","user_modulos":{"pcm":"leitura"}}';
select ok(config.sso_autorizar_acao('chamado.os.criar','16798001-0000-4000-8000-00000000000a'),'concessão para Cliente A');
select ok(not config.sso_autorizar_acao('chamado.os.criar','16798001-0000-4000-8000-00000000000b'),'sem concessão para Cliente B');
select is((select count(*)::int from pcm.equipamentos where client_id='16798001-0000-4000-8000-00000000000a' and deleted_at is null),205,'leitura do Cliente A sob RLS');
select is((select count(*)::int from pcm.equipamentos where client_id='16798001-0000-4000-8000-00000000000a' and deleted_at is null and id > '16798002-0000-4000-8000-000000000100' order by 1),105,'consulta após cursor alcança páginas seguintes');
select is((select count(*)::int from pcm.equipamentos where client_id='16798001-0000-4000-8000-00000000000b'),1,'caracterização: leitura direta expõe Cliente B apesar da ausência de concessão');
select * from finish();
rollback;
