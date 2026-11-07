-- Somente banco isolado; fixtures, permissões e gates são revertidos.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
set local app.auvo_sync_write = 'true';
select plan(8);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16630000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s166-ciclos-mediados@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16630000-0000-4000-8000-000000000001','colaborador','S166 ciclos',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('16630000-0000-4000-8000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('16630000-0000-4000-8000-00000000000a','Cliente A',true,'16630000-0000-4000-8000-000000000001'),
 ('16630000-0000-4000-8000-00000000000b','Cliente B',true,'16630000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16630000-0000-4000-8000-000000000001','plano.gerir','16630000-0000-4000-8000-00000000000a');
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values ('16630000-0000-4000-8000-000000000011','16630000-0000-4000-8000-00000000000a','Plano','aprovado','16630000-0000-4000-8000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,vigencia_inicio,vigencia_fim,snapshot,created_by) values
 ('16630000-0000-4000-8000-000000000021','16630000-0000-4000-8000-000000000011',1,'aprovado','2026-12-01','2027-01-31',
 '{"rotinas":[{"id":"16630000-0000-4000-8000-000000000031","modo":"calendario","data_base":"2026-12-25","intervalo_n":1,"intervalo_unidade":"meses","tolerancia_antes":2,"tolerancia_depois":5}]}'::jsonb,'16630000-0000-4000-8000-000000000001');
update pcm.sso_ciclos_uniformes_mediados_gate set habilitado=true where id;
set local role authenticated;
set local request.jwt.claims = '{"sub":"16630000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
select throws_ok($$select * from pcm.sso_consultar_ciclos_uniformes_mediada('16630000-0000-4000-8000-000000000001','16630000-0000-4000-8000-00000000000a','16630000-0000-4000-8000-000000000011','16630000-0000-4000-8000-000000000021','16630000-0000-4000-8000-000000000031',null,'2026-12-01','2027-01-31',null,20)$$,'55000','consulta_bloqueada','gate do núcleo continua obrigatório');
reset role;
update pcm.sso_consulta_uniforme_ciclos_gate set habilitado=true where id;
set local role authenticated;
select throws_ok($$select * from pcm.sso_consultar_ciclos_uniformes_mediada('16630000-0000-4000-8000-000000000009','16630000-0000-4000-8000-00000000000a','16630000-0000-4000-8000-000000000011','16630000-0000-4000-8000-000000000021','16630000-0000-4000-8000-000000000031',null,'2026-12-01','2027-01-31',null,20)$$,'42501',null,'ator divergente é recusado');
select throws_ok($$select * from pcm.sso_consultar_ciclos_uniformes_mediada('16630000-0000-4000-8000-000000000001','16630000-0000-4000-8000-00000000000b','16630000-0000-4000-8000-000000000011','16630000-0000-4000-8000-000000000021','16630000-0000-4000-8000-000000000031',null,'2026-12-01','2027-01-31',null,20)$$,'42501',null,'Cliente divergente é recusado');
select throws_ok($$select * from pcm.sso_consultar_ciclos_uniformes_mediada('16630000-0000-4000-8000-000000000001','16630000-0000-4000-8000-00000000000a','16630000-0000-4000-8000-000000000011','16630000-0000-4000-8000-000000000099','16630000-0000-4000-8000-000000000031',null,'2026-12-01','2027-01-31',null,20)$$,'42501',null,'versão divergente é recusada');
select is((select count(*)::int from pcm.sso_consultar_ciclos_uniformes_mediada('16630000-0000-4000-8000-000000000001','16630000-0000-4000-8000-00000000000a','16630000-0000-4000-8000-000000000011','16630000-0000-4000-8000-000000000021','16630000-0000-4000-8000-000000000031',null,'2026-12-01','2027-01-31',null,20)),2,'dois ciclos de calendário');
select is((select vencimento from pcm.sso_consultar_ciclos_uniformes_mediada('16630000-0000-4000-8000-000000000001','16630000-0000-4000-8000-00000000000a','16630000-0000-4000-8000-000000000011','16630000-0000-4000-8000-000000000021','16630000-0000-4000-8000-000000000031',null,'2026-12-01','2027-01-31',null,20) where chave='1'),'2027-01-25'::date,'ciclo seguinte preserva âncora');
select ok((select tolerancia_antes=2 and tolerancia_depois=5 from pcm.sso_consultar_ciclos_uniformes_mediada('16630000-0000-4000-8000-000000000001','16630000-0000-4000-8000-00000000000a','16630000-0000-4000-8000-000000000011','16630000-0000-4000-8000-000000000021','16630000-0000-4000-8000-000000000031',null,'2026-12-01','2027-01-31',null,20) where chave='0'),'tolerâncias independentes preservadas');
reset role;
update config.sso_concessoes set ativa=false where usuario_id='16630000-0000-4000-8000-000000000001' and acao='plano.gerir';
set local role authenticated;
select throws_ok($$select * from pcm.sso_consultar_ciclos_uniformes_mediada('16630000-0000-4000-8000-000000000001','16630000-0000-4000-8000-00000000000a','16630000-0000-4000-8000-000000000011','16630000-0000-4000-8000-000000000021','16630000-0000-4000-8000-000000000031',null,'2026-12-01','2027-01-31',null,20)$$,'42501',null,'revogação bloqueia consulta');
reset role;
select * from finish();
rollback;
