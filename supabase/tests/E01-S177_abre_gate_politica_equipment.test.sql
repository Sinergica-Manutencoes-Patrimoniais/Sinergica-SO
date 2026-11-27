-- pgTAP da migration 1909: abre pcm.sso_politica_equipment_gate. Prova: aberta; os gates dos
-- produtores T-24 (que enfileiram no Auvo) seguem FECHADOS; só superadmin lista e grava; idempotência
-- e revisão otimista; audit.events; permitido e negado.
begin;
select plan(12);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('17709000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s177-super@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('17709000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s177-colab@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('17709000-0000-4000-8000-000000000001','superadmin','Super sintético',true),
 ('17709000-0000-4000-8000-000000000002','colaborador','Colaborador sintético',true);
insert into pcm.equipamento_categorias(id,nome) values ('17709000-0000-4000-8000-000000000005','Categoria sintética 177');

select is((select habilitado from pcm.sso_politica_equipment_gate where id), true, 'gate de política aberto pela 1909');
select is((select habilitado from pcm.sso_t24_contrato_corretiva_gate where id), false, 'produtor T-24 corretivo segue FECHADO');
select is((select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='pcm' and c.relname='sso_politica_equipment_gate' and c.relrowsecurity and c.relforcerowsecurity), 1::bigint, 'trava segue com RLS enable + force');
select is((select count(*) from pcm.sso_politica_equipment_categoria), 0::bigint, 'política nasce vazia (nenhuma categoria controlada)');

-- NEGADO: colaborador
set local request.jwt.claims = '{"sub":"17709000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_politica_equipment('17709000-0000-4000-8000-000000000002',null,30)$$,'42501','sem_acesso','colaborador não lista');
select throws_ok($$select pcm.sso_configurar_politica_equipment('17709000-0000-4000-8000-000000000002','17709000-0000-4000-8000-0000000000a1','17709000-0000-4000-8000-000000000005',0,true,'x')$$,'42501','sem_acesso','colaborador não grava');
reset role;

-- PERMITIDO: superadmin
set local request.jwt.claims = '{"sub":"17709000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select ok((select count(*) from pcm.sso_listar_politica_equipment('17709000-0000-4000-8000-000000000001',null,30) where categoria_id='17709000-0000-4000-8000-000000000005' and controlado is null and revisao=0)=1, 'superadmin lista a categoria como não configurada');
select is((pcm.sso_configurar_politica_equipment('17709000-0000-4000-8000-000000000001','17709000-0000-4000-8000-0000000000a1','17709000-0000-4000-8000-000000000005',0,true,'motivo de teste')->>'revision')::int, 1, 'superadmin grava (revisão 1)');
-- idempotente: mesmo request_id e payload devolve o mesmo recibo
select is((pcm.sso_configurar_politica_equipment('17709000-0000-4000-8000-000000000001','17709000-0000-4000-8000-0000000000a1','17709000-0000-4000-8000-000000000005',0,true,'motivo de teste')->>'revision')::int, 1, 'repetição idempotente');
-- revisão obsoleta
select throws_ok($$select pcm.sso_configurar_politica_equipment('17709000-0000-4000-8000-000000000001','17709000-0000-4000-8000-0000000000a2','17709000-0000-4000-8000-000000000005',0,false,'outro')$$,'40001','revisao_obsoleta','revisão obsoleta recusada');
reset role;
select is((select count(*) from audit.events where action='codigo.politica_equipment_alterada' and entity_id='17709000-0000-4000-8000-000000000005'), 1::bigint, 'uma única auditoria (a repetição não duplica)');

-- reverso documentado
update pcm.sso_politica_equipment_gate set habilitado=false where id;
set local request.jwt.claims = '{"sub":"17709000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_politica_equipment('17709000-0000-4000-8000-000000000001',null,30)$$,'55000','politica_equipment_desabilitada','reverso devolve a recusa nomeada');
reset role;
select * from finish();
rollback;
