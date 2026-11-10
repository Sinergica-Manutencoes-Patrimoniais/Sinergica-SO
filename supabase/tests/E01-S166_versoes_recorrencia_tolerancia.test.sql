-- Somente prévias de snapshots; não simula nem declara execução de OS.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
set local app.auvo_sync_write = 'true';
select plan(7);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16630000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s166-versoes@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16630000-0000-0000-0000-000000000001','superadmin','Gestor versões S166',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('16630000-0000-0000-0000-00000000000a','Cliente versões S166',true,'16630000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16630000-0000-0000-0000-000000000001','plano.gerir','16630000-0000-0000-0000-00000000000a');
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values ('16630000-0000-0000-0000-000000000011','16630000-0000-0000-0000-00000000000a','Plano versões','aprovado','16630000-0000-0000-0000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,vigencia_inicio,vigencia_fim,snapshot,created_by) values
('16630000-0000-0000-0000-000000000021','16630000-0000-0000-0000-000000000011',1,'aprovado','2026-01-01','2026-12-31','{"rotinas":[{"id":"16630000-0000-0000-0000-000000000031","modo":"calendario","data_base":"2026-10-25","intervalo_n":1,"intervalo_unidade":"meses","tolerancia_antes":2,"tolerancia_depois":5}]}'::jsonb,'16630000-0000-0000-0000-000000000001'),
('16630000-0000-0000-0000-000000000022','16630000-0000-0000-0000-000000000011',2,'aprovado','2027-01-01',null,'{"rotinas":[{"id":"16630000-0000-0000-0000-000000000032","modo":"calendario","data_base":"2027-01-15","intervalo_n":3,"intervalo_unidade":"meses","tolerancia_antes":1,"tolerancia_depois":0}]}'::jsonb,'16630000-0000-0000-0000-000000000001');
set local request.jwt.claims = '{"sub":"16630000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is((select vencimento from pcm.sso_prever_ciclos_rotina('16630000-0000-0000-0000-000000000011','16630000-0000-0000-0000-000000000021','16630000-0000-0000-0000-000000000031','2026-12-01','2027-03-31')),'2026-12-25'::date,'histórico mantém vencimento original em data que pode ser feriado');
select ok((select tolerancia_antes=2 and tolerancia_depois=5 from pcm.sso_prever_ciclos_rotina('16630000-0000-0000-0000-000000000011','16630000-0000-0000-0000-000000000021','16630000-0000-0000-0000-000000000031','2026-12-01','2027-03-31')),'versão anterior preserva tolerâncias independentes');
select is((select count(*)::int from pcm.sso_prever_ciclos_rotina('16630000-0000-0000-0000-000000000011','16630000-0000-0000-0000-000000000021','16630000-0000-0000-0000-000000000031','2027-01-01','2027-03-31')),0,'versão anterior não projeta após vigência');
select is((select vencimento from pcm.sso_prever_ciclos_rotina('16630000-0000-0000-0000-000000000011','16630000-0000-0000-0000-000000000022','16630000-0000-0000-0000-000000000032','2026-12-01','2027-03-31')),'2027-01-15'::date,'versão nova usa nova âncora na própria vigência');
select ok((select tolerancia_antes=1 and tolerancia_depois=0 from pcm.sso_prever_ciclos_rotina('16630000-0000-0000-0000-000000000011','16630000-0000-0000-0000-000000000022','16630000-0000-0000-0000-000000000032','2026-12-01','2027-03-31')),'versão nova usa suas próprias tolerâncias');
select is((select count(*)::int from pcm.sso_prever_ciclos_rotina('16630000-0000-0000-0000-000000000011','16630000-0000-0000-0000-000000000022','16630000-0000-0000-0000-000000000032','2026-10-01','2026-12-31')),0,'versão nova não projeta antes da vigência');
select is((select vencimento from pcm.sso_prever_ciclos_rotina('16630000-0000-0000-0000-000000000011','16630000-0000-0000-0000-000000000022','16630000-0000-0000-0000-000000000032','2027-04-01','2027-04-30')),'2027-04-15'::date,'intervalo trimestral da nova versão é respeitado');
reset role;
select * from finish();
rollback;
