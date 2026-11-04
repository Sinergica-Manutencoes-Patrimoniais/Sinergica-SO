-- Prévia por calendário: sem geração de OS, visita ou envio externo.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
set local app.auvo_sync_write = 'true';
select plan(6);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16620000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s166-previa@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16620000-0000-0000-0000-000000000001','superadmin','Gestor prévia S166',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('16620000-0000-0000-0000-00000000000a','Cliente prévia S166',true,'16620000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16620000-0000-0000-0000-000000000001','plano.gerir','16620000-0000-0000-0000-00000000000a');
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values ('16620000-0000-0000-0000-000000000011','16620000-0000-0000-0000-00000000000a','Plano prévia','aprovado','16620000-0000-0000-0000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,vigencia_inicio,vigencia_fim,snapshot,created_by) values
('16620000-0000-0000-0000-000000000021','16620000-0000-0000-0000-000000000011',1,'aprovado','2026-12-01','2027-01-31',
'{"rotinas":[{"id":"16620000-0000-0000-0000-000000000031","modo":"calendario","data_base":"2026-12-25","intervalo_n":1,"intervalo_unidade":"meses","tolerancia_antes":2,"tolerancia_depois":5}]}'::jsonb,'16620000-0000-0000-0000-000000000001');
set local request.jwt.claims = '{"sub":"16620000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is((select vencimento from pcm.sso_prever_ciclos_rotina('16620000-0000-0000-0000-000000000011','16620000-0000-0000-0000-000000000021','16620000-0000-0000-0000-000000000031','2026-12-01','2027-01-31') where ciclo=0),'2026-12-25'::date,'vencimento original permanece em data que pode ser feriado');
select is((select vencimento from pcm.sso_prever_ciclos_rotina('16620000-0000-0000-0000-000000000011','16620000-0000-0000-0000-000000000021','16620000-0000-0000-0000-000000000031','2026-12-01','2027-01-31') where ciclo=1),'2027-01-25'::date,'ciclo seguinte conserva âncora original');
select ok((select tolerancia_antes=2 and tolerancia_depois=5 from pcm.sso_prever_ciclos_rotina('16620000-0000-0000-0000-000000000011','16620000-0000-0000-0000-000000000021','16620000-0000-0000-0000-000000000031','2026-12-01','2027-01-31') where ciclo=0),'prévia preserva tolerâncias independentes');
select is((select count(*)::int from pcm.sso_prever_ciclos_rotina('16620000-0000-0000-0000-000000000011','16620000-0000-0000-0000-000000000021','16620000-0000-0000-0000-000000000031','2027-02-01','2027-03-01')),0,'fora da vigência não apresenta ciclos');
select throws_ok($$ select * from pcm.sso_prever_ciclos_rotina('16620000-0000-0000-0000-000000000011','16620000-0000-0000-0000-000000000021','16620000-0000-0000-0000-000000000031','2027-01-02','2027-01-01') $$,'22023',null,'janela invertida é rejeitada');
select is((select count(*)::int from pcm.sso_prever_ciclos_rotina('16620000-0000-0000-0000-000000000011','16620000-0000-0000-0000-000000000021','16620000-0000-0000-0000-000000000031','2026-12-25','2026-12-25')),1,'limites da janela são inclusivos');
reset role;
select * from finish();
rollback;
