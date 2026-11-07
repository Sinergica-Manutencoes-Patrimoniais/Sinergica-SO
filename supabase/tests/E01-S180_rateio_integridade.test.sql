-- Fixtures sintéticas; executar apenas em banco descartável, com efeitos externos desabilitados.
begin;
select plan(10);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('18010000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pcm-180@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('18010000-0000-0000-0000-000000000001','superadmin','PCM S180',true);
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('18010000-0000-0000-0000-00000000000a','Cliente A S180',true,'18010000-0000-0000-0000-000000000001'),
 ('18010000-0000-0000-0000-00000000000b','Cliente B S180',true,'18010000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('18010000-0000-0000-0000-000000000001','despesa_visita.gerir','18010000-0000-0000-0000-00000000000a');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by) values
 ('18010000-0000-0000-0000-000000000011','18010000-0000-0000-0000-00000000000a','OS-S180-A1','OS A1','corretiva','18010000-0000-0000-0000-000000000001'),
 ('18010000-0000-0000-0000-000000000012','18010000-0000-0000-0000-00000000000a','OS-S180-A2','OS A2','corretiva','18010000-0000-0000-0000-000000000001'),
 ('18010000-0000-0000-0000-000000000013','18010000-0000-0000-0000-00000000000b','OS-S180-B','OS B','corretiva','18010000-0000-0000-0000-000000000001');
insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,created_by) values
 ('18010000-0000-0000-0000-000000000021','18010000-0000-0000-0000-00000000000a','2026-11-01 11:00+00','2026-11-01 13:00+00','America/Sao_Paulo','regular','18010000-0000-0000-0000-000000000001'),
 ('18010000-0000-0000-0000-000000000022','18010000-0000-0000-0000-00000000000b','2026-11-02 11:00+00','2026-11-02 13:00+00','America/Sao_Paulo','regular','18010000-0000-0000-0000-000000000001');
insert into pcm.visita_ordens_servico(id,visita_id,os_id,cliente_id,sequencia,created_by) values
 ('18010000-0000-0000-0000-000000000031','18010000-0000-0000-0000-000000000021','18010000-0000-0000-0000-000000000011','18010000-0000-0000-0000-00000000000a',1,'18010000-0000-0000-0000-000000000001'),
 ('18010000-0000-0000-0000-000000000032','18010000-0000-0000-0000-000000000021','18010000-0000-0000-0000-000000000012','18010000-0000-0000-0000-00000000000a',2,'18010000-0000-0000-0000-000000000001'),
 ('18010000-0000-0000-0000-000000000033','18010000-0000-0000-0000-000000000022','18010000-0000-0000-0000-000000000013','18010000-0000-0000-0000-00000000000b',1,'18010000-0000-0000-0000-000000000001');
insert into pcm.despesa_tipos(id,auvo_id,nome) values ('18010000-0000-0000-0000-000000000041',-1801001,'Categoria sintética S180');
insert into pcm.despesas_visita(id,visita_id,cliente_id,categoria_id,data,descricao,previsto_centavos,realizado_centavos,created_by) values
 ('18010000-0000-0000-0000-000000000051','18010000-0000-0000-0000-000000000021','18010000-0000-0000-0000-00000000000a','18010000-0000-0000-0000-000000000041','2026-11-01','Despesa A',10000,10000,'18010000-0000-0000-0000-000000000001'),
 ('18010000-0000-0000-0000-000000000052','18010000-0000-0000-0000-000000000022','18010000-0000-0000-0000-00000000000b','18010000-0000-0000-0000-000000000041','2026-11-02','Despesa B',10000,null,'18010000-0000-0000-0000-000000000001');
grant execute on function pcm.sso_ratear_despesa_visita(uuid,uuid,integer,jsonb),pcm.sso_consultar_rateio_despesa(uuid) to authenticated;
set local request.jwt.claims = '{"sub":"18010000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$ select pcm.sso_ratear_despesa_visita('18010000-0000-0000-0000-000000000061','18010000-0000-0000-0000-000000000051',1,'[{"vinculoId":"18010000-0000-0000-0000-000000000031","valorCentavos":6000}]') $$,'23514',null,'rateio parcial é recusado');
select throws_ok($$ select pcm.sso_ratear_despesa_visita('18010000-0000-0000-0000-000000000062','18010000-0000-0000-0000-000000000051',1,'[{"vinculoId":"18010000-0000-0000-0000-000000000033","valorCentavos":10000}]') $$,'23514',null,'vínculo de outra Conta é recusado');
select throws_ok($$ select pcm.sso_ratear_despesa_visita('18010000-0000-0000-0000-000000000063','18010000-0000-0000-0000-000000000052',1,'[]') $$,'42501',null,'despesa de outra Conta é inacessível');
select lives_ok($$ select pcm.sso_ratear_despesa_visita('18010000-0000-0000-0000-000000000064','18010000-0000-0000-0000-000000000051',1,'[{"vinculoId":"18010000-0000-0000-0000-000000000031","valorCentavos":6000},{"vinculoId":"18010000-0000-0000-0000-000000000032","valorCentavos":4000}]') $$,'rateio exato entre duas OS');
select is((pcm.sso_ratear_despesa_visita('18010000-0000-0000-0000-000000000064','18010000-0000-0000-0000-000000000051',1,'[{"vinculoId":"18010000-0000-0000-0000-000000000031","valorCentavos":6000},{"vinculoId":"18010000-0000-0000-0000-000000000032","valorCentavos":4000}]')->>'revision')::int,2,'retry retorna revisão sem duplicar');
select throws_ok($$ select pcm.sso_ratear_despesa_visita('18010000-0000-0000-0000-000000000064','18010000-0000-0000-0000-000000000051',1,'[]') $$,'23505',null,'request repetido com conteúdo alterado falha');
select throws_ok($$ select pcm.sso_ratear_despesa_visita('18010000-0000-0000-0000-000000000065','18010000-0000-0000-0000-000000000051',1,'[]') $$,'40001',null,'revisão antiga não sobrescreve rateio');
select is((select sum(valor_centavos)::bigint from pcm.sso_consultar_rateio_despesa('18010000-0000-0000-0000-000000000051')),10000::bigint,'parcelas somam apenas a despesa');
reset role;
select is((select count(*)::int from pcm.despesa_visita_rateios where despesa_id='18010000-0000-0000-0000-000000000051'),1,'um único rateio gravado');
select is((select realizado_centavos from pcm.despesas_visita where id='18010000-0000-0000-0000-000000000051'),10000::bigint,'rateio não multiplica o realizado');
select * from finish();
rollback;
