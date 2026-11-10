-- Banco descartável. Clones temporários neutralizam gate apenas neles; rollback integral.
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(13);
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
declare v_original text; v_copia text; v_nome text; v_sig text;
begin
 foreach v_nome in array array['sso_comando_escopo_chamado','sso_encerrar_chamado_conferido'] loop
  v_sig:=case when v_nome='sso_comando_escopo_chamado' then '(uuid,uuid,uuid,bigint,text,uuid,text,uuid,integer)' else '(uuid,uuid,uuid,bigint,text)' end;
  select pg_get_functiondef(('pcm.'||v_nome||v_sig)::regprocedure) into v_original;
  v_copia:=replace(v_original,'FUNCTION pcm.'||v_nome||'(', 'FUNCTION pg_temp.'||v_nome||'(');
  v_copia:=regexp_replace(v_copia,'if not coalesce\(\(select habilitado from pcm.chamado_os_gate where id\),\s*false\)( or not coalesce\(\(select habilitado from pcm.sso_encerramento_chamado_gate where id\),false\))? then','if false then');
  v_copia:=replace(v_copia,'pcm.sso_comando_escopo_chamado(gen_random_uuid()','pg_temp.sso_comando_escopo_chamado(gen_random_uuid()');
  if v_copia=v_original or position('if false then' in v_copia)=0 then raise exception 'falha ao criar cópia %',v_nome; end if;
  execute v_copia;
 end loop;
end $test$;
select throws_ok($$select pg_temp.sso_encerrar_chamado_conferido('16795001-0000-4000-8000-000000000041','16795001-0000-4000-8000-00000000000a','16795001-0000-4000-8000-000000000011',(select sso_revisao from pcm.chamados where id='16795001-0000-4000-8000-000000000011'),'Conferência sintética')$$,'23514','escopo_nao_atendido','OS legada em execução impede encerramento');
select ok((select sso_encerrado_em is null from pcm.chamados where id='16795001-0000-4000-8000-000000000011'),'falha preserva Chamado aberto');
update pcm.ordens_servico set status='finalizado' where id='16795001-0000-4000-8000-000000000022';
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by,ordem_servico_id) values ('16795001-0000-4000-8000-000000000012','CH-S167-FECHAR-2','16795001-0000-4000-8000-00000000000a','Chamado conflitante','16795001-0000-4000-8000-000000000001','16795001-0000-4000-8000-000000000022');
select throws_ok($$select pg_temp.sso_encerrar_chamado_conferido('16795001-0000-4000-8000-000000000043','16795001-0000-4000-8000-00000000000a','16795001-0000-4000-8000-000000000011',(select sso_revisao from s167_revisao),'Conferência sintética')$$,'23514','vinculo_legado_inconsistente','referência compartilhada impede encerramento');
update pcm.chamados set ordem_servico_id=null where id='16795001-0000-4000-8000-000000000012';
select lives_ok($$select pg_temp.sso_encerrar_chamado_conferido('16795001-0000-4000-8000-000000000042','16795001-0000-4000-8000-00000000000a','16795001-0000-4000-8000-000000000011',(select sso_revisao from pcm.chamados where id='16795001-0000-4000-8000-000000000011'),'Conferência sintética')$$,'ambas finalizadas permitem encerramento explícito');
select ok((select sso_encerrado_em is not null from pcm.chamados where id='16795001-0000-4000-8000-000000000011'),'encerramento grava estado do Chamado');
select lives_ok($$select pg_temp.sso_encerrar_chamado_conferido('16795001-0000-4000-8000-000000000042','16795001-0000-4000-8000-00000000000a','16795001-0000-4000-8000-000000000011',(select sso_revisao from s167_revisao),'Conferência sintética')$$,'retry idêntico retorna sem nova decisão');
select throws_ok($$select pg_temp.sso_encerrar_chamado_conferido('16795001-0000-4000-8000-000000000042','16795001-0000-4000-8000-00000000000a','16795001-0000-4000-8000-000000000011',(select sso_revisao from s167_revisao),'Motivo diferente')$$,'23505','request_id_conflitante','mesmo requestId com motivo diferente é rejeitado');
select set_config('request.jwt.claims','{"sub":"16795001-0000-4000-8000-000000000099","role":"authenticated"}',true);
select throws_ok($$select pg_temp.sso_encerrar_chamado_conferido('16795001-0000-4000-8000-000000000042','16795001-0000-4000-8000-00000000000a','16795001-0000-4000-8000-000000000011',(select sso_revisao from s167_revisao),'Conferência sintética')$$,'42501','sem_acesso','retry por usuário sem acesso é rejeitado');
select is((select count(*)::int from pcm.sso_encerramentos_chamado_conferidos where chamado_id='16795001-0000-4000-8000-000000000011'),1,'registra uma decisão conferida');
select ok(not has_function_privilege('authenticated','pcm.sso_encerrar_chamado_conferido(uuid,uuid,uuid,bigint,text)','execute') and not has_function_privilege('authenticated','pcm.sso_comando_escopo_chamado(uuid,uuid,uuid,bigint,text,uuid,text,uuid,integer)','execute'),'comandos reais seguem privados');
select is((select habilitado from pcm.chamado_os_gate where id),false,'gate real permanece fechado');
select is((select habilitado from pcm.sso_encerramento_chamado_gate where id),false,'gate real de encerramento permanece fechado');
select is((select count(*)::int from pcm.auvo_sync_outbox where row_id in ('16795001-0000-4000-8000-000000000021','16795001-0000-4000-8000-000000000022')),0,'sem intenção Auvo');
select * from finish();
rollback;
