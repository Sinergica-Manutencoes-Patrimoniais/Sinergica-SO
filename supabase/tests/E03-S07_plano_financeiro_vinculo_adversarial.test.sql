-- Prova adversarial de vínculo, NÃO de escopo por Cliente: o legado é global por módulo.
-- Executar somente em banco descartável, isolado de integrações. Tudo é revertido.
-- Assertions de negação são hipóteses de proteção e devem falhar até haver mediação.
begin;
set local app.auvo_sync_write='true';
select plan(10);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('30730000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vinculo-adversarial@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('30730000-0000-0000-0000-000000000001','colaborador','Comercial sintético',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('30730000-0000-0000-0000-000000000001','comercial','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('30730000-0000-0000-0000-00000000000a','Cliente sintético A',true,'30730000-0000-0000-0000-000000000001'),
 ('30730000-0000-0000-0000-00000000000b','Cliente sintético B',true,'30730000-0000-0000-0000-000000000001');
insert into comercial.etapas_funil(id,nome,ordem,cor,tipo) values ('30730000-0000-0000-0000-000000000011','Etapa sintética vínculo',13009,'#000000','aberta');
insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo) values ('30730000-0000-0000-0000-000000000021','30730000-0000-0000-0000-00000000000a','30730000-0000-0000-0000-000000000011','Oportunidade sintética A');
insert into comercial.propostas(id,oportunidade_id,tipo,status,custo_total_centavos,piso_centavos,preco_sugerido_centavos,preco_centavos) values ('30730000-0000-0000-0000-000000000031','30730000-0000-0000-0000-000000000021','residente','aceita',10000,10638,12766,50000);
insert into comercial.contratos(id,proposta_id,cliente_id,tipo,valor_mensal_centavos,vigencia_inicio,created_by) values ('30730000-0000-0000-0000-000000000041','30730000-0000-0000-0000-000000000031','30730000-0000-0000-0000-00000000000a','residente',50000,current_date,'30730000-0000-0000-0000-000000000001');
insert into financeiro.contratos(id,cliente_id,descricao,valor_mensal_centavos,dia_vencimento,inicio,created_by) values ('30730000-0000-0000-0000-000000000051','30730000-0000-0000-0000-00000000000b','Plano legado B',10000,5,current_date,'30730000-0000-0000-0000-000000000001');

set local request.jwt.claims='{"sub":"30730000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';
set local role authenticated;
select is((select count(*)::integer from comercial.contratos where id='30730000-0000-0000-0000-000000000041'),1,'Comercial autorizado acessa seu contrato sintético');
select lives_ok($$update comercial.contratos set escopo='[{"descricao":"editável"}]'::jsonb where id='30730000-0000-0000-0000-000000000041'$$,'Comercial mantém edição legítima do rascunho');
select throws_ok($$update comercial.contratos set status='ativo',financeiro_contrato_id='30730000-0000-0000-0000-000000000051' where id='30730000-0000-0000-0000-000000000041'$$,null,null,'Comercial não altera diretamente status ou vínculo financeiro');
select throws_ok($$select financeiro.fn_criar_plano_faturamento('30730000-0000-0000-0000-00000000000b','Plano divergente',99999,5,current_date,null,'30730000-0000-0000-0000-000000000041')$$,null,null,'não cria plano do Cliente B vinculado a contrato do Cliente A');
select throws_ok($$select financeiro.fn_criar_plano_faturamento('30730000-0000-0000-0000-00000000000b','Plano comercial sem vínculo',10000,5,current_date,null,null)$$,null,null,'Comercial não cria plano financeiro sem vínculo pela RPC direta');
select throws_ok($$select financeiro.fn_encerrar_plano_faturamento('30730000-0000-0000-0000-000000000051',current_date)$$,null,null,'Comercial não encerra pela RPC um plano legado sem vínculo');
reset role;
select is((select count(*)::integer from comercial.contratos where id='30730000-0000-0000-0000-000000000041' and status='rascunho' and financeiro_contrato_id is null),1,'escrita direta não modificou estado ou vínculo');
select is((select count(*)::integer from financeiro.contratos where comercial_contrato_id='30730000-0000-0000-0000-000000000041' and cliente_id='30730000-0000-0000-0000-00000000000b'),0,'plano de Cliente divergente não foi gravado');
select is((select count(*)::integer from financeiro.contratos where descricao='Plano comercial sem vínculo'),0,'plano comercial sem vínculo não foi gravado');
select is((select status from financeiro.contratos where id='30730000-0000-0000-0000-000000000051'),'ativo','plano legado permanece ativo');
select * from finish();
rollback;
