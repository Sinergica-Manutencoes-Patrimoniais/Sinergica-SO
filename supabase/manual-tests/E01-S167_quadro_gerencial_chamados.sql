-- Somente banco isolado; testa cópia temporária sem alterar gate. Rollback integral.
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(13);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('16798001-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-quadro@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16798001-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values
 ('16798001-0000-4000-8000-00000000000a','Cliente A','16798001-0000-4000-8000-000000000001'),
 ('16798001-0000-4000-8000-00000000000b','Cliente B','16798001-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16798001-0000-4000-8000-000000000001','chamado.encerrar','16798001-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values
 ('16798001-0000-4000-8000-000000000011','CH-S167-GER-1','16798001-0000-4000-8000-00000000000a','Chamado A','16798001-0000-4000-8000-000000000001'),
 ('16798001-0000-4000-8000-000000000012','CH-S167-GER-2','16798001-0000-4000-8000-00000000000a','Chamado sem OS','16798001-0000-4000-8000-000000000001'),
 ('16798001-0000-4000-8000-000000000013','CH-S167-GER-3','16798001-0000-4000-8000-00000000000b','Chamado outro Cliente','16798001-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,created_by,chamado_id) values
 ('16798001-0000-4000-8000-000000000021','16798001-0000-4000-8000-00000000000a','ignorado','OS direta','corretiva','finalizado','16798001-0000-4000-8000-000000000001','16798001-0000-4000-8000-000000000011'),
 ('16798001-0000-4000-8000-000000000022','16798001-0000-4000-8000-00000000000a','OS-S167-GER-LEGADA','OS legada','corretiva','em_execucao','16798001-0000-4000-8000-000000000001',null);
update pcm.chamados set ordem_servico_id='16798001-0000-4000-8000-000000000022' where id='16798001-0000-4000-8000-000000000011';
select set_config('request.jwt.claims','{"sub":"16798001-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
do $test$
declare v_original text; v_copia text;
begin
 select pg_get_functiondef('pcm.sso_listar_chamados_gerenciais(uuid,uuid,integer)'::regprocedure) into v_original;
 v_copia:=replace(v_original,'FUNCTION pcm.sso_listar_chamados_gerenciais(', 'FUNCTION pg_temp.sso_listar_chamados_gerenciais(');
 v_copia:=replace(v_copia,'if not coalesce((select g.habilitado from pcm.sso_quadro_chamados_gate g where g.id),false) then','if false then');
 if position('if false then' in v_copia)=0 then raise exception 'cópia de teste inválida'; end if;
 execute v_copia;
end $test$;
select is((select count(*)::int from pg_temp.sso_listar_chamados_gerenciais('16798001-0000-4000-8000-00000000000a',null,50)),2,'um card por Chamado de Cliente A');
select is((select total_os::int from pg_temp.sso_listar_chamados_gerenciais('16798001-0000-4000-8000-00000000000a',null,50) where id='16798001-0000-4000-8000-000000000011'),2,'conta OS direta e legada');
select is((select finalizadas::int from pg_temp.sso_listar_chamados_gerenciais('16798001-0000-4000-8000-00000000000a',null,50) where id='16798001-0000-4000-8000-000000000011'),1,'conta somente OS finalizada');
select ok((select etapas_mistas from pg_temp.sso_listar_chamados_gerenciais('16798001-0000-4000-8000-00000000000a',null,50) where id='16798001-0000-4000-8000-000000000011'),'etapas diferentes são sinalizadas');
select is((select total_os::int from pg_temp.sso_listar_chamados_gerenciais('16798001-0000-4000-8000-00000000000a',null,50) where id='16798001-0000-4000-8000-000000000012'),0,'Chamado sem OS tem zero');
select is((select count(*)::int from pg_temp.sso_listar_chamados_gerenciais('16798001-0000-4000-8000-00000000000a','16798001-0000-4000-8000-000000000011',1)),1,'cursor encontra próximo Chamado sem duplicação');
select throws_ok($$select * from pg_temp.sso_listar_chamados_gerenciais('16798001-0000-4000-8000-00000000000b',null,50)$$,'42501','cliente_nao_encontrado_ou_sem_acesso','Cliente sem concessão é rejeitado');
select throws_ok($$select * from pcm.sso_listar_chamados_gerenciais('16798001-0000-4000-8000-00000000000a',null,50)$$,'55000','quadro_chamados_bloqueado','gate real permanece fechado');
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_chamados_gerenciais('16798001-0000-4000-8000-00000000000a',null,50)$$,'55000','quadro_chamados_bloqueado','gate bloqueia também chamada como authenticated');
reset role;
select ok(has_function_privilege('authenticated','pcm.sso_listar_chamados_gerenciais(uuid,uuid,integer)','execute') and not has_function_privilege('anon','pcm.sso_listar_chamados_gerenciais(uuid,uuid,integer)','execute'),'somente autenticado pode executar wrapper');
update pcm.chamados set ordem_servico_id='16798001-0000-4000-8000-000000000022' where id='16798001-0000-4000-8000-000000000013';
select throws_ok($$select * from pg_temp.sso_listar_chamados_gerenciais('16798001-0000-4000-8000-00000000000a',null,50)$$,'23514','vinculo_legado_inconsistente','referência compartilhada falha sem mostrar progresso falso');
select is((select count(*)::int from pcm.auvo_sync_outbox where row_id in ('16798001-0000-4000-8000-000000000021','16798001-0000-4000-8000-000000000022')),0,'nenhuma intenção Auvo');
select is((select habilitado from pcm.sso_quadro_chamados_gate where id),false,'gate não foi alterado');
select * from finish();
rollback;
