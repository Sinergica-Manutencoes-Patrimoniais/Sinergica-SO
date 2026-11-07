-- Banco descartável. Clones temporários neutralizam gate apenas neles; rollback integral.
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(9);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16795001-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-encerrar@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16795001-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values ('16795001-0000-4000-8000-00000000000a','Cliente A','16795001-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16795001-0000-4000-8000-000000000001','chamado.encerrar','16795001-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values ('16795001-0000-4000-8000-000000000011','CH-S167-FECHAR','16795001-0000-4000-8000-00000000000a','Chamado A','16795001-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,created_by,chamado_id) values
 ('16795001-0000-4000-8000-000000000021','16795001-0000-4000-8000-00000000000a','ignorado','OS direta','corretiva','finalizado','16795001-0000-4000-8000-000000000001','16795001-0000-4000-8000-000000000011'),
 ('16795001-0000-4000-8000-000000000022','16795001-0000-4000-8000-00000000000a','OS-S167-FECHAR','OS legada','corretiva','em_execucao','16795001-0000-4000-8000-000000000001',null);
update pcm.chamados set ordem_servico_id='16795001-0000-4000-8000-000000000022' where id='16795001-0000-4000-8000-000000000011';
insert into pcm.chamado_escopo_composicoes(chamado_id,declarada_completa) values ('16795001-0000-4000-8000-000000000011',true);
insert into pcm.chamado_escopo_parcelas(id,chamado_id,descricao,situacao,created_by,os_atendimento_id) values ('16795001-0000-4000-8000-000000000031','16795001-0000-4000-8000-000000000011','Parcela','atendida','16795001-0000-4000-8000-000000000001','16795001-0000-4000-8000-000000000021');
select set_config('request.jwt.claims','{"sub":"16795001-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
create temp table s167_revisao as select sso_revisao from pcm.chamados where id='16795001-0000-4000-8000-000000000011';
do $test$
declare v_original text; v_copia text;
begin
 select pg_get_functiondef('pcm.sso_cancelar_chamado_conservador(uuid,uuid,uuid,bigint,text)'::regprocedure) into v_original;
 v_copia:=replace(v_original,'FUNCTION pcm.sso_cancelar_chamado_conservador(', 'FUNCTION pg_temp.sso_cancelar_chamado_conservador(');
 v_copia:=replace(v_copia,'if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_cancelamento_chamado_gate where id),false) then','if false then');
 if position('if false then' in v_copia)=0 then raise exception 'cópia inválida'; end if;
 execute v_copia;
end $test$;
select throws_ok($$select pg_temp.sso_cancelar_chamado_conservador('16795001-0000-4000-8000-000000000041','16795001-0000-4000-8000-00000000000a','16795001-0000-4000-8000-000000000011',(select sso_revisao from pcm.chamados where id='16795001-0000-4000-8000-000000000011'),'Motivo')$$,'23514','escopo_ou_os_pendente','OS legada em execução impede cancelamento');
select isnt((select status from pcm.chamados where id='16795001-0000-4000-8000-000000000011'),'cancelado','falha preserva chamado');
update pcm.ordens_servico set status='finalizado' where id='16795001-0000-4000-8000-000000000022';
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by,ordem_servico_id) values ('16795001-0000-4000-8000-000000000012','CH-S167-CANCEL-2','16795001-0000-4000-8000-00000000000a','Chamado conflitante','16795001-0000-4000-8000-000000000001','16795001-0000-4000-8000-000000000022');
select throws_ok($$select pg_temp.sso_cancelar_chamado_conservador('16795001-0000-4000-8000-000000000041','16795001-0000-4000-8000-00000000000a','16795001-0000-4000-8000-000000000011',(select sso_revisao from pcm.chamados where id='16795001-0000-4000-8000-000000000011'),'Motivo')$$,'23514','vinculo_legado_inconsistente','compartilhamento inconsistente é rejeitado');
update pcm.chamados set ordem_servico_id=null where id='16795001-0000-4000-8000-000000000012';
select lives_ok($$select pg_temp.sso_cancelar_chamado_conservador('16795001-0000-4000-8000-000000000041','16795001-0000-4000-8000-00000000000a','16795001-0000-4000-8000-000000000011',(select sso_revisao from pcm.chamados where id='16795001-0000-4000-8000-000000000011'),'Motivo')$$,'OS resolvidas permitem cancelamento');
select is((select status from pcm.chamados where id='16795001-0000-4000-8000-000000000011'),'cancelado','chamado cancelado');
select is((select count(*)::int from pcm.ordens_servico where id in ('16795001-0000-4000-8000-000000000021','16795001-0000-4000-8000-000000000022') and status='finalizado'),2,'nenhuma OS alterada');
select ok(not has_function_privilege('authenticated','pcm.sso_cancelar_chamado_conservador(uuid,uuid,uuid,bigint,text)','execute'),'núcleo segue privado');
select is((select habilitado from pcm.sso_cancelamento_chamado_gate where id),false,'gate real fechado');
select is((select count(*)::int from pcm.auvo_sync_outbox where row_id in ('16795001-0000-4000-8000-000000000021','16795001-0000-4000-8000-000000000022')),0,'sem intenção Auvo');
select * from finish();
rollback;
