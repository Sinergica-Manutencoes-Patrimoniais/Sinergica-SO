-- Banco descartável, dados sintéticos, sem integrações; todas as mutações são revertidas.
-- Rejeições propostas devem falhar no código atual; diferenças entre Clientes não implicam escopo por Cliente.
begin;
set local app.auvo_sync_write='true';
select plan(11);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('30740000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vinculo-financeiro@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('30740000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','autoria-comercial@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('30740000-0000-0000-0000-000000000001','colaborador','Financeiro sintético',true),
 ('30740000-0000-0000-0000-000000000002','colaborador','Comercial sintético',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values
 ('30740000-0000-0000-0000-000000000001','financeiro','escrita'),
 ('30740000-0000-0000-0000-000000000002','comercial','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('30740000-0000-0000-0000-00000000000a','Cliente sintético A',true,'30740000-0000-0000-0000-000000000001'),
 ('30740000-0000-0000-0000-00000000000b','Cliente sintético B',true,'30740000-0000-0000-0000-000000000001');
insert into comercial.etapas_funil(id,nome,ordem,cor,tipo) values ('30740000-0000-0000-0000-000000000011','Etapa sintética autoria',13010,'#000000','aberta');
insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo) values ('30740000-0000-0000-0000-000000000021','30740000-0000-0000-0000-00000000000a','30740000-0000-0000-0000-000000000011','Oportunidade sintética');
insert into comercial.propostas(id,oportunidade_id,tipo,status,custo_total_centavos,piso_centavos,preco_sugerido_centavos,preco_centavos) values
 ('30740000-0000-0000-0000-000000000031','30740000-0000-0000-0000-000000000021','residente','aceita',10000,10638,12766,50000),
 ('30740000-0000-0000-0000-000000000032','30740000-0000-0000-0000-000000000021','residente','aceita',10000,10638,12766,50000);
insert into comercial.contratos(id,proposta_id,cliente_id,tipo,valor_mensal_centavos,vigencia_inicio,status,created_by) values
 ('30740000-0000-0000-0000-000000000041','30740000-0000-0000-0000-000000000031','30740000-0000-0000-0000-00000000000a','residente',50000,current_date,'ativo','30740000-0000-0000-0000-000000000002');
insert into financeiro.contratos(id,cliente_id,descricao,valor_mensal_centavos,dia_vencimento,inicio,comercial_contrato_id,created_by) values
 ('30740000-0000-0000-0000-000000000051','30740000-0000-0000-0000-00000000000a','Plano Comercial sintético',50000,5,current_date,'30740000-0000-0000-0000-000000000041','30740000-0000-0000-0000-000000000002');
update comercial.contratos set financeiro_contrato_id='30740000-0000-0000-0000-000000000051' where id='30740000-0000-0000-0000-000000000041';
create function pg_temp.tentar_encerrar_plano_direto() returns integer language plpgsql security invoker as $$
declare v_afetados integer;
begin
  update financeiro.contratos set status='encerrado',fim=current_date where id='30740000-0000-0000-0000-000000000051';
  get diagnostics v_afetados = row_count;
  return v_afetados;
exception when insufficient_privilege then return 0;
end $$;

set local request.jwt.claims='{"sub":"30740000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
set local role authenticated;
select lives_ok($$select financeiro.fn_criar_plano_faturamento('30740000-0000-0000-0000-00000000000b','Plano Financeiro legítimo',10000,5,current_date,null,null)$$,'Financeiro ainda cria plano próprio sem vínculo Comercial');
select throws_ok($$select financeiro.fn_criar_plano_faturamento('30740000-0000-0000-0000-00000000000b','Cliente divergente',10000,5,current_date,null,'30740000-0000-0000-0000-000000000041')$$,null,null,'RPC não vincula plano do Cliente B a contrato do Cliente A');
select throws_ok($$select financeiro.fn_criar_plano_faturamento('30740000-0000-0000-0000-00000000000a','Plano duplicado',50000,5,current_date,null,'30740000-0000-0000-0000-000000000041')$$,null,null,'RPC não cria segundo plano para mesmo contrato Comercial');
select throws_ok($$select financeiro.fn_encerrar_plano_faturamento('30740000-0000-0000-0000-000000000051',current_date)$$,null,null,'RPC não encerra isoladamente plano vinculado ao Comercial');
select throws_ok($$insert into financeiro.contratos(cliente_id,descricao,valor_mensal_centavos,dia_vencimento,inicio,comercial_contrato_id) values ('30740000-0000-0000-0000-00000000000b','Vínculo direto divergente',10000,5,current_date,'30740000-0000-0000-0000-000000000041')$$,null,null,'INSERT direto não forja vínculo de plano Comercial');
select is(pg_temp.tentar_encerrar_plano_direto(),0,'UPDATE direto não encerra isoladamente plano vinculado');
reset role;
select is((select count(*)::integer from financeiro.contratos where comercial_contrato_id='30740000-0000-0000-0000-000000000041'),1,'somente plano Comercial original permanece vinculado');
select is((select status from financeiro.contratos where id='30740000-0000-0000-0000-000000000051'),'ativo','plano vinculado permanece ativo');
select is((select status from comercial.contratos where id='30740000-0000-0000-0000-000000000041'),'ativo','contrato Comercial permanece ativo');
set local request.jwt.claims='{"sub":"30740000-0000-0000-0000-000000000002","role":"authenticated","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';
set local role authenticated;
select throws_ok($$insert into comercial.contratos(id,proposta_id,cliente_id,tipo,valor_mensal_centavos,vigencia_inicio,created_by) values ('30740000-0000-0000-0000-000000000042','30740000-0000-0000-0000-000000000032','30740000-0000-0000-0000-00000000000a','residente',50000,current_date,'30740000-0000-0000-0000-000000000001')$$,null,null,'Comercial não forja autoria de outro usuário ao inserir contrato');
reset role;
select is((select count(*)::integer from comercial.contratos where id='30740000-0000-0000-0000-000000000042'),0,'contrato com autoria forjada não foi criado');
select * from finish();
rollback;
