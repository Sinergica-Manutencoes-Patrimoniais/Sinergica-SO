-- Testes adversariais: falham enquanto INSERT direto admitir vínculo inválido.
begin;
set local app.auvo_sync_write = 'true';
select plan(9);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('30730000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','contrato-vinculo-sintetico@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('30730000-0000-0000-0000-000000000001','colaborador','Comercial vínculo S07',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('30730000-0000-0000-0000-000000000001','comercial','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('30730000-0000-0000-0000-00000000000a','Cliente A sintético',true,'30730000-0000-0000-0000-000000000001'),
 ('30730000-0000-0000-0000-00000000000b','Cliente B sintético',true,'30730000-0000-0000-0000-000000000001');
insert into comercial.etapas_funil(id,nome,ordem,cor,tipo) values ('30730000-0000-0000-0000-000000000011','Etapa vínculo S07',13073,'#000000','aberta');
insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo) values
 ('30730000-0000-0000-0000-000000000021','30730000-0000-0000-0000-00000000000a','30730000-0000-0000-0000-000000000011','Oportunidade A');
insert into comercial.propostas(id,oportunidade_id,tipo,status,custo_total_centavos,piso_centavos,preco_sugerido_centavos,preco_centavos) values
 ('30730000-0000-0000-0000-000000000031','30730000-0000-0000-0000-000000000021','simples','rascunho',10000,10638,12766,12766),
 ('30730000-0000-0000-0000-000000000032','30730000-0000-0000-0000-000000000021','simples','aceita',10000,10638,12766,12766),
 ('30730000-0000-0000-0000-000000000033','30730000-0000-0000-0000-000000000021','simples','aceita',10000,10638,12766,12766),
 ('30730000-0000-0000-0000-000000000034','30730000-0000-0000-0000-000000000021','simples','aceita',10000,10638,12766,12766),
 ('30730000-0000-0000-0000-000000000035','30730000-0000-0000-0000-000000000021','simples','aceita',10000,10638,12766,12766);
set local request.jwt.claims = '{"sub":"30730000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';
set local role authenticated;
select throws_ok($$insert into comercial.contratos(id,proposta_id,cliente_id,tipo,vigencia_inicio,created_by) values ('30730000-0000-0000-0000-000000000041','30730000-0000-0000-0000-000000000031','30730000-0000-0000-0000-00000000000a','avulso',current_date,'30730000-0000-0000-0000-000000000001')$$,null,null,'proposta não aceita não gera contrato por INSERT direto');
select throws_ok($$insert into comercial.contratos(id,proposta_id,cliente_id,tipo,vigencia_inicio,created_by) values ('30730000-0000-0000-0000-000000000042','30730000-0000-0000-0000-000000000032','30730000-0000-0000-0000-00000000000b','avulso',current_date,'30730000-0000-0000-0000-000000000001')$$,null,null,'proposta aceita não pode gerar contrato para Cliente divergente');
select lives_ok($$insert into comercial.contratos(id,proposta_id,cliente_id,tipo,vigencia_inicio,created_by) values ('30730000-0000-0000-0000-000000000044','30730000-0000-0000-0000-000000000034','30730000-0000-0000-0000-00000000000a','avulso',current_date,'30730000-0000-0000-0000-000000000001')$$,'INSERT válido de rascunho permanece permitido');
select lives_ok($$select comercial.fn_criar_contrato('30730000-0000-0000-0000-000000000035')$$,'RPC legítima cria contrato sem expor custos');
select is((select count(*)::integer from comercial.propostas where id='30730000-0000-0000-0000-000000000035'),0,'usuário continua sem leitura da tabela com custos');
reset role;
select is((select count(*)::integer from comercial.contratos where id in ('30730000-0000-0000-0000-000000000041','30730000-0000-0000-0000-000000000042')),0,'recusas preservam ausência de rascunhos inválidos');
select is((select count(*)::integer from comercial.contratos where proposta_id in ('30730000-0000-0000-0000-000000000031','30730000-0000-0000-0000-000000000032')),0,'recusas não consomem unicidade das propostas');
update config.usuario_modulos set nivel='leitura' where user_id='30730000-0000-0000-0000-000000000001' and modulo='comercial';
set local role authenticated;
select throws_ok($$insert into comercial.contratos(id,proposta_id,cliente_id,tipo,vigencia_inicio,created_by) values ('30730000-0000-0000-0000-000000000043','30730000-0000-0000-0000-000000000033','30730000-0000-0000-0000-00000000000a','avulso',current_date,'30730000-0000-0000-0000-000000000001')$$,'42501',null,'JWT antigo não permite INSERT após revogar escrita');
reset role;
select is((select count(*)::integer from comercial.contratos where id='30730000-0000-0000-0000-000000000043'),0,'revogação preserva ausência de contrato');
select * from finish();
rollback;
