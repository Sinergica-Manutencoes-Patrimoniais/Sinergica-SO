-- Prova adversarial da ativação após alteração de origem; não bloqueia alterações de negócio.
-- Executar somente em banco descartável, com integrações suprimidas; tudo é revertido.
begin;
set local app.auvo_sync_write='true';
select plan(8);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('30750000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','origem-contrato-apos@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('30750000-0000-0000-0000-000000000001','superadmin','Usuário sintético',true);
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('30750000-0000-0000-0000-00000000000a','Cliente sintético A',true,'30750000-0000-0000-0000-000000000001'),
 ('30750000-0000-0000-0000-00000000000b','Cliente sintético B',true,'30750000-0000-0000-0000-000000000001');
insert into comercial.etapas_funil(id,nome,ordem,cor,tipo) values ('30750000-0000-0000-0000-000000000011','Etapa sintética origem posterior',13011,'#000000','aberta');
insert into comercial.etapas_funil(id,nome,ordem,cor,tipo) values ('30750000-0000-0000-0000-000000000012','Etapa ganha origem posterior',13012,'#00ff00','ganha');
insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo) values
 ('30750000-0000-0000-0000-000000000021','30750000-0000-0000-0000-00000000000a','30750000-0000-0000-0000-000000000011','Origem 1'),
 ('30750000-0000-0000-0000-000000000022','30750000-0000-0000-0000-00000000000a','30750000-0000-0000-0000-000000000011','Origem 2'),
 ('30750000-0000-0000-0000-000000000023','30750000-0000-0000-0000-00000000000a','30750000-0000-0000-0000-000000000011','Origem 3'),
 ('30750000-0000-0000-0000-000000000024','30750000-0000-0000-0000-00000000000a','30750000-0000-0000-0000-000000000011','Origem 4'),
 ('30750000-0000-0000-0000-000000000025','30750000-0000-0000-0000-00000000000b','30750000-0000-0000-0000-000000000011','Outra origem');
insert into comercial.propostas(id,oportunidade_id,tipo,status,custo_total_centavos,piso_centavos,preco_sugerido_centavos,preco_centavos) values
 ('30750000-0000-0000-0000-000000000031','30750000-0000-0000-0000-000000000021','simples','aceita',10000,10638,12766,12766),
 ('30750000-0000-0000-0000-000000000032','30750000-0000-0000-0000-000000000022','simples','aceita',10000,10638,12766,12766),
 ('30750000-0000-0000-0000-000000000033','30750000-0000-0000-0000-000000000023','simples','aceita',10000,10638,12766,12766),
 ('30750000-0000-0000-0000-000000000034','30750000-0000-0000-0000-000000000024','simples','aceita',10000,10638,12766,12766);
insert into comercial.contratos(id,proposta_id,cliente_id,tipo,vigencia_inicio,created_by) values
 ('30750000-0000-0000-0000-000000000041','30750000-0000-0000-0000-000000000031','30750000-0000-0000-0000-00000000000a','avulso',current_date,'30750000-0000-0000-0000-000000000001'),
 ('30750000-0000-0000-0000-000000000042','30750000-0000-0000-0000-000000000032','30750000-0000-0000-0000-00000000000a','avulso',current_date,'30750000-0000-0000-0000-000000000001'),
 ('30750000-0000-0000-0000-000000000043','30750000-0000-0000-0000-000000000033','30750000-0000-0000-0000-00000000000a','avulso',current_date,'30750000-0000-0000-0000-000000000001'),
 ('30750000-0000-0000-0000-000000000044','30750000-0000-0000-0000-000000000034','30750000-0000-0000-0000-00000000000a','avulso',current_date,'30750000-0000-0000-0000-000000000001');
update comercial.contratos set tipo='residente',valor_mensal_centavos=50000 where id in ('30750000-0000-0000-0000-000000000041','30750000-0000-0000-0000-000000000042');
set local request.jwt.claims='{"sub":"30750000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select lives_ok($$update comercial.oportunidades set cliente_id='30750000-0000-0000-0000-00000000000b' where id='30750000-0000-0000-0000-000000000021'$$,'alteração posterior de Cliente não é bloqueada por este teste');
select throws_ok($$select comercial.fn_ativar_contrato('30750000-0000-0000-0000-000000000041')$$,null,null,'contrato não ativa com Cliente divergente da oportunidade');
select lives_ok($$update comercial.oportunidades set deleted_at=now() where id='30750000-0000-0000-0000-000000000022'$$,'exclusão posterior não é bloqueada por este teste');
select throws_ok($$select comercial.fn_ativar_contrato('30750000-0000-0000-0000-000000000042')$$,null,null,'contrato não ativa com oportunidade excluída');
reset role;
select is((select status from comercial.contratos where id='30750000-0000-0000-0000-000000000041'),'rascunho','divergência preserva rascunho');
select is((select count(*)::integer from financeiro.contratos where comercial_contrato_id='30750000-0000-0000-0000-000000000041'),0,'divergência não cria plano');
select is((select status from comercial.contratos where id='30750000-0000-0000-0000-000000000042'),'rascunho','exclusão preserva rascunho');
select is((select count(*)::integer from financeiro.contratos where comercial_contrato_id='30750000-0000-0000-0000-000000000042'),0,'exclusão não cria plano');
select * from finish();
rollback;
