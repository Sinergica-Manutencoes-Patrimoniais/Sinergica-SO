-- Prova adversarial: banco descartável, dados sintéticos, transação revertida.
-- Enquanto a mediação e a revogação efetiva não forem corrigidas, há asserts vermelhos esperados.
begin;
set local app.auvo_sync_write = 'true';
select plan(19);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('30710000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','contrato-permissao-atual@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('30710000-0000-0000-0000-000000000001','colaborador','Comercial sintético',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('30710000-0000-0000-0000-000000000001','comercial','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values ('30710000-0000-0000-0000-00000000000a','Cliente sintético',true,'30710000-0000-0000-0000-000000000001');
insert into comercial.etapas_funil(id,nome,ordem,cor,tipo) values ('30710000-0000-0000-0000-000000000011','Etapa sintética S07',13007,'#000000','aberta');
insert into comercial.etapas_funil(id,nome,ordem,cor,tipo) values ('30710000-0000-0000-0000-000000000012','Etapa ganha sintética S07',13008,'#00ff00','ganha');
insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo) values ('30710000-0000-0000-0000-000000000021','30710000-0000-0000-0000-00000000000a','30710000-0000-0000-0000-000000000011','Oportunidade sintética');
insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo) values ('30710000-0000-0000-0000-000000000022','30710000-0000-0000-0000-00000000000a','30710000-0000-0000-0000-000000000011','Oportunidade falha sintética');
insert into comercial.propostas(id,oportunidade_id,tipo,status,custo_total_centavos,piso_centavos,preco_sugerido_centavos,preco_centavos) values
 ('30710000-0000-0000-0000-000000000031','30710000-0000-0000-0000-000000000021','residente','aceita',10000,10638,12766,50000),
 ('30710000-0000-0000-0000-000000000032','30710000-0000-0000-0000-000000000021','simples','aceita',10000,10638,12766,12766),
 ('30710000-0000-0000-0000-000000000033','30710000-0000-0000-0000-000000000022','residente','aceita',10000,10638,12766,50000);
insert into comercial.contratos(id,proposta_id,cliente_id,tipo,valor_mensal_centavos,vigencia_inicio,created_by) values
 ('30710000-0000-0000-0000-000000000041','30710000-0000-0000-0000-000000000032','30710000-0000-0000-0000-00000000000a','avulso',null,current_date,'30710000-0000-0000-0000-000000000001');
insert into comercial.contratos(id,proposta_id,cliente_id,tipo,valor_mensal_centavos,vigencia_inicio,created_by) values
 ('30710000-0000-0000-0000-000000000042','30710000-0000-0000-0000-000000000033','30710000-0000-0000-0000-00000000000a','residente',50000,current_date,'30710000-0000-0000-0000-000000000001');
create function pg_temp.s07_falha_etapa() returns trigger language plpgsql as $$ begin raise exception 'falha_sintetica_etapa' using errcode='23514'; end $$;
create trigger s07_falha_etapa_sintetica before update on comercial.oportunidades for each row when (old.id='30710000-0000-0000-0000-000000000022') execute function pg_temp.s07_falha_etapa();

set local request.jwt.claims = '{"sub":"30710000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';
set local role authenticated;
select is((select count(*)::integer from comercial.propostas where id='30710000-0000-0000-0000-000000000031'),0,'colaborador não lê tabela com custos');
select is((select count(*)::integer from comercial.propostas_sem_custos where id='30710000-0000-0000-0000-000000000031'),1,'colaborador ativo consulta projeção sem custos');
select lives_ok($$select comercial.fn_criar_contrato('30710000-0000-0000-0000-000000000031')$$,'escrita atual cria contrato sem acesso aos custos');
select lives_ok($$select comercial.fn_ativar_contrato((select id from comercial.contratos where proposta_id='30710000-0000-0000-0000-000000000031'))$$,'escrita atual ativa contrato e plano');
select is((select e.tipo from comercial.oportunidades o join comercial.etapas_funil e on e.id=o.etapa_id where o.id='30710000-0000-0000-0000-000000000021'),'ganha','ativação movimenta oportunidade para ganha');
reset role;
select is((select count(*)::integer from financeiro.contratos f join comercial.contratos c on c.id=f.comercial_contrato_id where c.proposta_id='30710000-0000-0000-0000-000000000031' and c.status='ativo'),1,'plano e contrato ativo vinculados');
set local role authenticated;
select lives_ok($$select comercial.fn_encerrar_contrato((select id from comercial.contratos where proposta_id='30710000-0000-0000-0000-000000000031'),'Encerramento sintético',current_date)$$,'Comercial encerra contrato e plano vinculado');
reset role;
select is((select count(*)::integer from financeiro.contratos f join comercial.contratos c on c.id=f.comercial_contrato_id where c.proposta_id='30710000-0000-0000-0000-000000000031' and c.status='encerrado' and f.status='encerrado'),1,'encerramento preserva vínculo e atualiza ambos estados');
set local role authenticated;
select throws_ok($$select comercial.fn_ativar_contrato('30710000-0000-0000-0000-000000000042')$$,'23514',null,'falha ao mover oportunidade aborta ativação');
reset role;
select is((select status from comercial.contratos where id='30710000-0000-0000-0000-000000000042'),'rascunho','falha na oportunidade reverte status do contrato');
select is((select count(*)::integer from financeiro.contratos where comercial_contrato_id='30710000-0000-0000-0000-000000000042'),0,'falha na oportunidade reverte plano financeiro');
set local role authenticated;

reset role;
update config.usuario_modulos set nivel='leitura' where user_id='30710000-0000-0000-0000-000000000001' and modulo='comercial';
set local role authenticated;
with alterados as (update comercial.contratos set escopo='[{"descricao":"alteração após revogação"}]'::jsonb where id='30710000-0000-0000-0000-000000000041' returning id)
select is((select count(*)::integer from alterados),0,'JWT antigo não permite UPDATE direto após revogar escrita');
select throws_ok($$select financeiro.fn_criar_plano_faturamento('30710000-0000-0000-0000-00000000000a','Plano sintético',10000,5,current_date,null,null)$$,'42501',null,'JWT antigo não cria plano financeiro após revogar escrita');

reset role;
update config.usuarios set ativo=false where user_id='30710000-0000-0000-0000-000000000001';
set local role authenticated;
select is((select count(*)::integer from comercial.contratos where id='30710000-0000-0000-0000-000000000041'),0,'usuário desativado não lê contrato com JWT antigo');
select throws_ok($$select financeiro.fn_criar_plano_faturamento('30710000-0000-0000-0000-00000000000a','Plano sintético',10000,5,current_date,null,null)$$,'42501',null,'usuário desativado não cria plano financeiro com JWT antigo');
reset role;
update config.usuarios set ativo=true where user_id='30710000-0000-0000-0000-000000000001';
insert into config.usuario_modulos(user_id,modulo,nivel) values ('30710000-0000-0000-0000-000000000001','financeiro','escrita');
set local request.jwt.claims = '{"sub":"30710000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
set local role authenticated;
select lives_ok($$select financeiro.fn_criar_plano_faturamento('30710000-0000-0000-0000-00000000000a','Plano legado sintético',10000,5,current_date,null,null)$$,'Financeiro com escrita atual ainda cria plano sem contrato Comercial');
select lives_ok($$select financeiro.fn_encerrar_plano_faturamento((select id from financeiro.contratos where descricao='Plano legado sintético' and cliente_id='30710000-0000-0000-0000-00000000000a'),current_date)$$,'Financeiro com escrita atual ainda encerra plano legado');
reset role;
update config.usuario_modulos set nivel='leitura' where user_id='30710000-0000-0000-0000-000000000001' and modulo='financeiro';
set local role authenticated;
select throws_ok($$select financeiro.fn_encerrar_plano_faturamento((select id from financeiro.contratos where descricao='Plano legado sintético' and cliente_id='30710000-0000-0000-0000-00000000000a'),current_date)$$,'42501',null,'JWT antigo não encerra plano após revogar escrita Financeiro');
set local request.jwt.claims = '{"sub":"30710000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin","user_modulos":{}}';
select throws_ok($$select financeiro.fn_criar_plano_faturamento('30710000-0000-0000-0000-00000000000a','Plano sintético',10000,5,current_date,null,null)$$,'42501',null,'papel divergente da conta não conserva acesso financeiro');
reset role;
select * from finish();
rollback;
