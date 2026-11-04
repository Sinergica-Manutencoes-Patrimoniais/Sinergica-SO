-- Fixtures sintéticas; somente banco descartável, sem integrações externas.
begin;
select plan(12);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('18210000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','financeiro-182@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('18210000-0000-0000-0000-000000000001','superadmin','Financeiro S182',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('18210000-0000-0000-0000-00000000000a','Cliente A S182',true,'18210000-0000-0000-0000-000000000001'),('18210000-0000-0000-0000-00000000000b','Cliente B S182',true,'18210000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('18210000-0000-0000-0000-000000000001','faturavel.efetivar','18210000-0000-0000-0000-00000000000a');
insert into financeiro.categorias(id,nome,tipo) values ('18210000-0000-0000-0000-000000000011','Categoria sintética S182','entrada');
insert into financeiro.lancamentos(id,tipo,status,valor_centavos,data_competencia,data_pagamento,categoria_id,cliente_id,descricao) values
 ('18210000-0000-0000-0000-000000000021','entrada','realizado',10000,'2026-11-01','2026-11-01','18210000-0000-0000-0000-000000000011','18210000-0000-0000-0000-00000000000a','Lançamento sintético A'),
 ('18210000-0000-0000-0000-000000000022','entrada','realizado',10000,'2026-11-01','2026-11-01','18210000-0000-0000-0000-000000000011','18210000-0000-0000-0000-00000000000b','Lançamento sintético B');
insert into financeiro.itens_faturaveis(id,cliente_id,origem_tipo,origem_id,valor_original_centavos,valor_conferido_centavos,competencia,status,revisao) values
 ('18210000-0000-0000-0000-000000000031','18210000-0000-0000-0000-00000000000a','teste_sintetico','18210000-0000-0000-0000-000000000041',10000,10000,'2026-11-01','conferido',2),
 ('18210000-0000-0000-0000-000000000032','18210000-0000-0000-0000-00000000000b','teste_sintetico','18210000-0000-0000-0000-000000000042',10000,10000,'2026-11-01','conferido',2);
select throws_ok($$ insert into financeiro.itens_faturaveis(id,cliente_id,origem_tipo,origem_id,valor_original_centavos,competencia) values ('18210000-0000-0000-0000-000000000033','18210000-0000-0000-0000-00000000000a','teste_sintetico','18210000-0000-0000-0000-000000000041',10000,'2026-11-01') $$,'23505',null,'mesma origem base não cria segundo item');
update financeiro.sso_faturamento_gate set habilitado=true where id;
grant execute on function financeiro.sso_alocar_faturavel_documento(uuid,uuid,uuid,integer,uuid,text,date,bigint) to authenticated;
set local request.jwt.claims = '{"sub":"18210000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$ select financeiro.sso_alocar_faturavel_documento('18210000-0000-0000-0000-000000000051','18210000-0000-0000-0000-000000000061','18210000-0000-0000-0000-000000000031',2,'18210000-0000-0000-0000-000000000022','DOC-B','2026-11-01',6000) $$,'42501',null,'não vincula documento de outra Conta');
select throws_ok($$ select financeiro.sso_alocar_faturavel_documento('18210000-0000-0000-0000-000000000052','18210000-0000-0000-0000-000000000062','18210000-0000-0000-0000-000000000032',2,'18210000-0000-0000-0000-000000000022','DOC-B','2026-11-01',6000) $$,'42501',null,'não aloca item de Conta sem concessão');
select lives_ok($$ select financeiro.sso_alocar_faturavel_documento('18210000-0000-0000-0000-000000000053','18210000-0000-0000-0000-000000000063','18210000-0000-0000-0000-000000000031',2,'18210000-0000-0000-0000-000000000021','DOC-A','2026-11-01',6000) $$,'alocação parcial registra 6000 centavos');
select is((financeiro.sso_alocar_faturavel_documento('18210000-0000-0000-0000-000000000053','18210000-0000-0000-0000-000000000063','18210000-0000-0000-0000-000000000031',2,'18210000-0000-0000-0000-000000000021','DOC-A','2026-11-01',6000)->>'saldoCentavos')::bigint,4000::bigint,'retry idêntico conserva saldo');
select is((financeiro.sso_alocar_faturavel_documento('18210000-0000-0000-0000-000000000053','18210000-0000-0000-0000-000000000063','18210000-0000-0000-0000-000000000031',2,'18210000-0000-0000-0000-000000000021','DOC-A','2026-11-01',6000)->>'revision')::integer,3,'segundo replay mantém revisão original');
select throws_ok($$ select financeiro.sso_alocar_faturavel_documento('18210000-0000-0000-0000-000000000053','18210000-0000-0000-0000-000000000063','18210000-0000-0000-0000-000000000031',2,'18210000-0000-0000-0000-000000000021','DOC-A','2026-11-01',5000) $$,'23505',null,'request com valor divergente não substitui parcela');
select throws_ok($$ select financeiro.sso_alocar_faturavel_documento('18210000-0000-0000-0000-000000000053','18210000-0000-0000-0000-000000000064','18210000-0000-0000-0000-000000000031',2,'18210000-0000-0000-0000-000000000021','DOC-A','2026-11-01',6000) $$,'23505',null,'request não pode trocar identidade da alocação');
select throws_ok($$ select financeiro.sso_alocar_faturavel_documento('18210000-0000-0000-0000-000000000055','18210000-0000-0000-0000-000000000065','18210000-0000-0000-0000-000000000031',2,'18210000-0000-0000-0000-000000000021','DOC-A','2026-11-01',1000) $$,'40001',null,'segundo pedido com revisão anterior é recusado');
select throws_ok($$ select financeiro.sso_alocar_faturavel_documento('18210000-0000-0000-0000-000000000054','18210000-0000-0000-0000-000000000064','18210000-0000-0000-0000-000000000031',3,'18210000-0000-0000-0000-000000000021','DOC-A','2026-11-01',5000) $$,'23514',null,'parcela maior que saldo é recusada');
reset role;
select is((select count(*)::int from financeiro.sso_faturavel_alocacoes where item_id='18210000-0000-0000-0000-000000000031'),1,'retry não duplica alocação');
select is((select valor_centavos from financeiro.sso_faturavel_alocacoes where id='18210000-0000-0000-0000-000000000063'),6000::bigint,'conflitos não substituem valor original');
select * from finish();
rollback;
