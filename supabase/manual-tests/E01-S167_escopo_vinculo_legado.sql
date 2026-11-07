-- Banco isolado; cópia temporária neutraliza gate somente na cópia. Rollback integral.
-- Na raiz: awk 'BEGIN {print "begin;"} {print}' supabase/migrations/1022_E01-S167_escopo_vinculo_legado.sql supabase/manual-tests/E01-S167_escopo_vinculo_legado.sql | docker exec -i sso_diagnostico_reconstrucao psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1
-- Conferir saída pgTAP: psql pode retornar 0 mesmo com algum "not ok".
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(11);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16793000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-escopo@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16793000-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values
 ('16793000-0000-4000-8000-00000000000a','Cliente A','16793000-0000-4000-8000-000000000001'),
 ('16793000-0000-4000-8000-00000000000b','Cliente B','16793000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16793000-0000-4000-8000-000000000001','chamado.encerrar','16793000-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values
 ('16793000-0000-4000-8000-000000000011','CH-S167-ESC-A','16793000-0000-4000-8000-00000000000a','Chamado A','16793000-0000-4000-8000-000000000001'),
 ('16793000-0000-4000-8000-000000000012','CH-S167-ESC-B','16793000-0000-4000-8000-00000000000b','Chamado B','16793000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by,chamado_id) values
 ('16793000-0000-4000-8000-000000000021','16793000-0000-4000-8000-00000000000a','OS-S167-ESC','OS unilateral','corretiva','16793000-0000-4000-8000-000000000001',null);
update pcm.chamados set ordem_servico_id='16793000-0000-4000-8000-000000000021' where id='16793000-0000-4000-8000-000000000011';
select set_config('request.jwt.claims','{"sub":"16793000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
do $test$
declare v_original text; v_copia text;
begin
 select pg_get_functiondef('pcm.sso_consultar_escopo_chamado_preparado(uuid,uuid)'::regprocedure) into v_original;
 v_copia:=replace(v_original,'FUNCTION pcm.sso_consultar_escopo_chamado_preparado(', 'FUNCTION pg_temp.sso_consultar_escopo_chamado_preparado(');
 v_copia:=replace(v_copia,'if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) then','if false then');
 if v_copia=v_original or position('if false then' in v_copia)=0 then raise exception 'falha ao criar cópia'; end if;
 execute v_copia;
end $test$;
select is(jsonb_array_length(pg_temp.sso_consultar_escopo_chamado_preparado('16793000-0000-4000-8000-00000000000a','16793000-0000-4000-8000-000000000011')->'ordens'),1,'ordem de vínculo unilateral válido aparece no escopo');
select is((pg_temp.sso_consultar_escopo_chamado_preparado('16793000-0000-4000-8000-00000000000a','16793000-0000-4000-8000-000000000011')->>'incompleto')::boolean,false,'resultado de uma OS é completo');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by,chamado_id) values
 ('16793000-0000-4000-8000-000000000022','16793000-0000-4000-8000-00000000000a','ignorado','OS direta','corretiva','16793000-0000-4000-8000-000000000001','16793000-0000-4000-8000-000000000011');
select is(jsonb_array_length(pg_temp.sso_consultar_escopo_chamado_preparado('16793000-0000-4000-8000-00000000000a','16793000-0000-4000-8000-000000000011')->'ordens'),2,'união inclui ordem direta e singular distinta');
insert into pcm.chamado_escopo_parcelas(id,chamado_id,descricao,created_by)
select gen_random_uuid(),'16793000-0000-4000-8000-000000000011','Parcela sintética','16793000-0000-4000-8000-000000000001' from generate_series(1,101);
select is((pg_temp.sso_consultar_escopo_chamado_preparado('16793000-0000-4000-8000-00000000000a','16793000-0000-4000-8000-000000000011')->>'incompleto')::boolean,true,'mais de 100 parcelas sinaliza recorte incompleto');
update pcm.chamados set ordem_servico_id='16793000-0000-4000-8000-000000000022' where id='16793000-0000-4000-8000-000000000011';
select is(jsonb_array_length(pg_temp.sso_consultar_escopo_chamado_preparado('16793000-0000-4000-8000-00000000000a','16793000-0000-4000-8000-000000000011')->'ordens'),1,'referência dupla à mesma OS não duplica resultado');
update pcm.chamados set ordem_servico_id='16793000-0000-4000-8000-000000000021' where id='16793000-0000-4000-8000-000000000011';
update pcm.chamados set ordem_servico_id='16793000-0000-4000-8000-000000000021' where id='16793000-0000-4000-8000-000000000012';
select throws_ok($$select pg_temp.sso_consultar_escopo_chamado_preparado('16793000-0000-4000-8000-00000000000a','16793000-0000-4000-8000-000000000011')$$,'23514','vinculo_legado_inconsistente','referência compartilhada não produz consulta incompleta silenciosa');
select is((select habilitado from pcm.chamado_os_gate where id),false,'gate operacional permanece fechado');
select is((select count(*)::int from pcm.auvo_sync_outbox where row_id='16793000-0000-4000-8000-000000000021'),0,'sem intenção Auvo');
select throws_ok($$select pcm.sso_consultar_escopo_chamado_preparado('16793000-0000-4000-8000-00000000000a','16793000-0000-4000-8000-000000000011')$$,'55000','comando_bloqueado','função operacional permanece bloqueada');
select ok(not has_function_privilege('authenticated','pcm.sso_consultar_escopo_chamado_preparado(uuid,uuid)','execute')
  and not has_function_privilege('anon','pcm.sso_consultar_escopo_chamado_preparado(uuid,uuid)','execute')
  and not has_function_privilege('service_role','pcm.sso_consultar_escopo_chamado_preparado(uuid,uuid)','execute'), 'ACL da função real permanece restrita');
select set_config('request.jwt.claims','{"sub":"16793000-0000-4000-8000-000000000099","role":"authenticated"}',true);
select throws_ok($$select pg_temp.sso_consultar_escopo_chamado_preparado('16793000-0000-4000-8000-00000000000a','16793000-0000-4000-8000-000000000011')$$,'42501','chamado_nao_encontrado_ou_sem_acesso','cópia rejeita usuário sem acesso');
select * from finish();
rollback;
