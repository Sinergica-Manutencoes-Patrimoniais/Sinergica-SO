-- Apenas banco diagnóstico isolado, sem rede externa nem cron; nenhum dado operacional.
-- Os quatro comandos devem recusar a disputa antes de adquirir locks de entidade.
-- Extensões, gates e fixtures são revertidos; a conexão auxiliar apenas toma advisory lock.
begin;
set local app.auvo_sync_write = 'true';
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set local search_path=extensions,public;
select plan(9);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16630000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ordem-s166@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16630000-0000-0000-0000-000000000001','superadmin','Ordem S166',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('16630000-0000-0000-0000-00000000000a','Cliente sintético',true,'16630000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16630000-0000-0000-0000-000000000001','plano.gerir','16630000-0000-0000-0000-00000000000a');
update pcm.sso_concorrencia_impacto_gate set habilitado=true where id;
update pcm.sso_materializar_ciclo_canonico_gate set habilitado=true where id;
update pcm.sso_identidade_ciclo_gate set habilitado=true where id;
update pcm.ocorrencia_rotina_gate set habilitado=true where id;
update pcm.sso_guarda_ciclo_canonico_gate set habilitado=true where id;
update pcm.sso_materializar_ciclo_legado_gate set habilitado=true where id;
update pcm.sso_integrar_ciclo_existente_gate set habilitado=true where id;
update pcm.sso_lote_ciclos_calendario_gate set habilitado=true where id;
update pcm.sso_lote_ciclos_legados_gate set habilitado=true where id;
select extensions.dblink_connect_u('s166lock','dbname=postgres user=postgres');
select extensions.dblink_exec('s166lock','begin');
select * from extensions.dblink('s166lock', $$select 1 from (select pg_advisory_xact_lock(hashtextextended('sso-impacto-revisao-protocolo-global-v1',0))) x$$) as t(n integer);
set local request.jwt.claims = '{"sub":"16630000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$select pcm.sso_materializar_ciclo_canonico('16630000-0000-0000-0000-000000000101','16630000-0000-0000-0000-00000000000a','16630000-0000-0000-0000-000000000011','16630000-0000-0000-0000-000000000012','16630000-0000-0000-0000-000000000013',1,current_date)$$,'55P03',null,'ciclo canônico obtém guarda antes de acessar Plano');
reset role;
select throws_ok($$select pcm.sso_materializar_ciclo_legado('16630000-0000-0000-0000-000000000102','16630000-0000-0000-0000-00000000000a','16630000-0000-0000-0000-000000000014','16630000-0000-0000-0000-000000000015','16630000-0000-0000-0000-000000000016','16630000-0000-0000-0000-000000000017','teste')$$,'55P03',null,'ciclo legado obtém guarda antes de acessar preparada');
select throws_ok($$select pcm.sso_materializar_lote_calendario('16630000-0000-0000-0000-000000000103','16630000-0000-0000-0000-00000000000a','16630000-0000-0000-0000-000000000011','16630000-0000-0000-0000-000000000012','16630000-0000-0000-0000-000000000013',1,current_date,current_date)$$,'55P03',null,'lote canônico obtém guarda antes de acessar Plano');
select throws_ok($$select pcm.sso_materializar_lote_legado('16630000-0000-0000-0000-000000000104','16630000-0000-0000-0000-00000000000a','16630000-0000-0000-0000-000000000011','16630000-0000-0000-0000-000000000015','16630000-0000-0000-0000-000000000016',1,array['16630000-0000-0000-0000-000000000014'::uuid],'teste')$$,'55P03',null,'lote legado obtém guarda antes de acessar Plano');
select ok(not has_function_privilege('authenticated','pcm.sso_guardar_ordem_ciclo(uuid)','execute'),'helper não é público');
select ok(has_function_privilege('authenticated','pcm.sso_materializar_ciclo_canonico(uuid,uuid,uuid,uuid,uuid,integer,date)','execute'),'ACL da fronteira canônica preservada');
select ok(not has_function_privilege('authenticated','pcm.sso_materializar_ciclo_legado(uuid,uuid,uuid,uuid,uuid,uuid,text)','execute'),'fronteira legada continua privada');
select ok(has_function_privilege('authenticated','pcm.sso_materializar_lote_calendario(uuid,uuid,uuid,uuid,uuid,integer,date,date)','execute'),'ACL do lote preservada');
update pcm.sso_concorrencia_impacto_gate set habilitado=false where id;
set local role authenticated;
select throws_ok($$select pcm.sso_materializar_ciclo_canonico('16630000-0000-0000-0000-000000000101','16630000-0000-0000-0000-00000000000a','16630000-0000-0000-0000-000000000011','16630000-0000-0000-0000-000000000012','16630000-0000-0000-0000-000000000013',1,current_date)$$,'23514',null,'gate desligado preserva recusa original');
reset role;
select extensions.dblink_exec('s166lock','rollback');
select extensions.dblink_disconnect('s166lock');
select * from finish();
rollback;
