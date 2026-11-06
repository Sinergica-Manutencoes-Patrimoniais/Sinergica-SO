-- Prova adversarial: banco descartável, dados sintéticos, transação revertida.
-- Asserções podem falhar enquanto a RLS direta Financeiro usar somente claims do JWT.
begin;
set local app.auvo_sync_write='true';
select plan(14);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('30720000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','financeiro-direto-s07@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('30720000-0000-0000-0000-000000000001','colaborador','Financeiro sintético',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('30720000-0000-0000-0000-000000000001','financeiro','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values ('30720000-0000-0000-0000-00000000000a','Cliente sintético',true,'30720000-0000-0000-0000-000000000001');
insert into financeiro.contratos(id,cliente_id,descricao,valor_mensal_centavos,dia_vencimento,inicio,created_by) values
 ('30720000-0000-0000-0000-000000000011','30720000-0000-0000-0000-00000000000a','Consulta',10000,5,current_date,'30720000-0000-0000-0000-000000000001'),
 ('30720000-0000-0000-0000-000000000012','30720000-0000-0000-0000-00000000000a','Atualização',10000,5,current_date,'30720000-0000-0000-0000-000000000001'),
 ('30720000-0000-0000-0000-000000000013','30720000-0000-0000-0000-00000000000a','Exclusão',10000,5,current_date,'30720000-0000-0000-0000-000000000001'),
 ('30720000-0000-0000-0000-000000000014','30720000-0000-0000-0000-00000000000a','Atualização inativo',10000,5,current_date,'30720000-0000-0000-0000-000000000001'),
 ('30720000-0000-0000-0000-000000000015','30720000-0000-0000-0000-00000000000a','Exclusão inativo',10000,5,current_date,'30720000-0000-0000-0000-000000000001');
set local request.jwt.claims='{"sub":"30720000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
set local role authenticated;
select is((select count(*)::int from financeiro.contratos where id='30720000-0000-0000-0000-000000000011'),1,'usuário ativo consulta plano');
select lives_ok($$insert into financeiro.contratos(id,cliente_id,descricao,valor_mensal_centavos,dia_vencimento,inicio) values ('30720000-0000-0000-0000-000000000016','30720000-0000-0000-0000-00000000000a','Escrita vigente',10000,5,current_date)$$,'escrita vigente insere plano');
with alterados as (update financeiro.contratos set descricao='Escrita vigente atualizada' where id='30720000-0000-0000-0000-000000000016' returning id) select is((select count(*)::int from alterados),1,'escrita vigente altera plano');
with excluidos as (delete from financeiro.contratos where id='30720000-0000-0000-0000-000000000016' returning id) select is((select count(*)::int from excluidos),1,'escrita vigente exclui plano');
reset role;
update config.usuario_modulos set nivel='leitura' where user_id='30720000-0000-0000-0000-000000000001' and modulo='financeiro';
set local role authenticated;
select is((select count(*)::int from financeiro.contratos where id='30720000-0000-0000-0000-000000000011'),1,'leitura atual continua permitida após downgrade');
select throws_ok($$insert into financeiro.contratos(cliente_id,descricao,valor_mensal_centavos,dia_vencimento,inicio) values ('30720000-0000-0000-0000-00000000000a','Inserção revogada',10000,5,current_date)$$,'42501',null,'JWT antigo não insere após revogar escrita');
with alterados as (update financeiro.contratos set descricao='alterado indevidamente' where id='30720000-0000-0000-0000-000000000012' returning id) select is((select count(*)::int from alterados),0,'JWT antigo não altera após revogar escrita');
with excluidos as (delete from financeiro.contratos where id='30720000-0000-0000-0000-000000000013' returning id) select is((select count(*)::int from excluidos),0,'JWT antigo não exclui após revogar escrita');
reset role;
update config.usuarios set ativo=false where user_id='30720000-0000-0000-0000-000000000001';
set local role authenticated;
select is((select count(*)::int from financeiro.contratos where id='30720000-0000-0000-0000-000000000011'),0,'usuário desativado não consulta com JWT antigo');
select throws_ok($$insert into financeiro.contratos(cliente_id,descricao,valor_mensal_centavos,dia_vencimento,inicio) values ('30720000-0000-0000-0000-00000000000a','Inserção inativo',10000,5,current_date)$$,'42501',null,'usuário desativado não insere');
with alterados as (update financeiro.contratos set descricao='alterado indevidamente' where id='30720000-0000-0000-0000-000000000014' returning id) select is((select count(*)::int from alterados),0,'usuário desativado não altera');
with excluidos as (delete from financeiro.contratos where id='30720000-0000-0000-0000-000000000015' returning id) select is((select count(*)::int from excluidos),0,'usuário desativado não exclui');
reset role;
update config.usuarios set ativo=true,papel='supervisor' where user_id='30720000-0000-0000-0000-000000000001';
update config.usuario_modulos set nivel='escrita' where user_id='30720000-0000-0000-0000-000000000001' and modulo='financeiro';
set local role authenticated;
select is((select count(*)::int from financeiro.contratos where id='30720000-0000-0000-0000-000000000011'),0,'papel antigo no JWT não lê após mudança de papel');
select throws_ok($$insert into financeiro.contratos(cliente_id,descricao,valor_mensal_centavos,dia_vencimento,inicio) values ('30720000-0000-0000-0000-00000000000a','Papel desatualizado',10000,5,current_date)$$,'42501',null,'papel antigo no JWT não insere após mudança de papel');
reset role;
select * from finish();
rollback;
