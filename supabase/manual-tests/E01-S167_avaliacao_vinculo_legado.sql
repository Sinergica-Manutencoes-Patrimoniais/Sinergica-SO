-- Banco descartável, gate real fechado; clones temporários substituem apenas a checagem de gate.
-- Na raiz: awk 'BEGIN {print "begin;"} {print}' supabase/migrations/1026_E01-S167_avaliacao_vinculo_legado.sql supabase/manual-tests/E01-S167_avaliacao_vinculo_legado.sql | docker exec -i sso_diagnostico_reconstrucao psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1
-- Conferir saída pgTAP: psql pode retornar 0 mesmo com "not ok".
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(13);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16794000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-avaliacao@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16794000-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values ('16794000-0000-4000-8000-00000000000a','Cliente A','16794000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16794000-0000-4000-8000-000000000001','chamado.encerrar','16794000-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values ('16794000-0000-4000-8000-000000000011','CH-S167-AVAL','16794000-0000-4000-8000-00000000000a','Chamado A','16794000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,created_by,chamado_id) values
 ('16794000-0000-4000-8000-000000000021','16794000-0000-4000-8000-00000000000a','ignorado','OS direta','corretiva','finalizado','16794000-0000-4000-8000-000000000001','16794000-0000-4000-8000-000000000011'),
 ('16794000-0000-4000-8000-000000000022','16794000-0000-4000-8000-00000000000a','OS-S167-AVAL','OS legada','corretiva','em_execucao','16794000-0000-4000-8000-000000000001',null);
update pcm.chamados set ordem_servico_id='16794000-0000-4000-8000-000000000022' where id='16794000-0000-4000-8000-000000000011';
insert into pcm.chamado_escopo_composicoes(chamado_id,declarada_completa) values ('16794000-0000-4000-8000-000000000011',true);
insert into pcm.chamado_escopo_parcelas(id,chamado_id,descricao,situacao,created_by,os_atendimento_id) values
 ('16794000-0000-4000-8000-000000000031','16794000-0000-4000-8000-000000000011','Parcela','atendida','16794000-0000-4000-8000-000000000001','16794000-0000-4000-8000-000000000021');
select set_config('request.jwt.claims','{"sub":"16794000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
do $test$
declare v_original text; v_copia text; v_nome text;
begin
 foreach v_nome in array array['sso_avaliar_encerramento_chamado','sso_diagnosticar_aptidao_chamado','sso_listar_itens_aptidao_chamado'] loop
  select pg_get_functiondef(('pcm.'||v_nome||case when v_nome='sso_listar_itens_aptidao_chamado' then '(uuid,uuid,text,uuid,integer)' else '(uuid,uuid)' end)::regprocedure) into v_original;
  v_copia:=replace(v_original,'FUNCTION pcm.'||v_nome||'(', 'FUNCTION pg_temp.'||v_nome||'(');
  v_copia:=regexp_replace(v_copia,'if not coalesce\(\(select habilitado from pcm.chamado_os_gate where id\),\s*false\)( or not coalesce\(\(select habilitado from pcm.sso_encerramento_chamado_gate where id\),false\))? then','if false then');
  if v_copia=v_original or position('if false then' in v_copia)=0 then raise exception 'falha ao criar cópia %',v_nome; end if;
  execute v_copia;
 end loop;
end $test$;
select is((pg_temp.sso_avaliar_encerramento_chamado('16794000-0000-4000-8000-00000000000a','16794000-0000-4000-8000-000000000011')->>'ordensNaoFinalizadas')::integer,1,'avaliação considera OS legada pendente');
select is((pg_temp.sso_diagnosticar_aptidao_chamado('16794000-0000-4000-8000-00000000000a','16794000-0000-4000-8000-000000000011')->>'aptoIndicativo')::boolean,false,'diagnóstico não afirma aptidão com OS legada pendente');
select is((select count(*)::int from pg_temp.sso_listar_itens_aptidao_chamado('16794000-0000-4000-8000-00000000000a','16794000-0000-4000-8000-000000000011','os',null,20)),2,'lista inclui OS direta e legada');
select is((select count(*)::int from pg_temp.sso_listar_itens_aptidao_chamado('16794000-0000-4000-8000-00000000000a','16794000-0000-4000-8000-000000000011','os','16794000-0000-4000-8000-000000000021',1)),1,'cursor alcança OS legada sem repetição');
update pcm.ordens_servico set status='finalizado' where id='16794000-0000-4000-8000-000000000022';
select is((pg_temp.sso_diagnosticar_aptidao_chamado('16794000-0000-4000-8000-00000000000a','16794000-0000-4000-8000-000000000011')->>'aptoIndicativo')::boolean,true,'ambas finalizadas permitem aptidão indicativa');
update pcm.chamado_escopo_parcelas set os_atendimento_id='16794000-0000-4000-8000-000000000022' where id='16794000-0000-4000-8000-000000000031';
select is((pg_temp.sso_diagnosticar_aptidao_chamado('16794000-0000-4000-8000-00000000000a','16794000-0000-4000-8000-000000000011')->>'parcelasPendentesOuInconsistentes')::integer,0,'parcela atendida pela OS legada finalizada é reconhecida');
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by,ordem_servico_id) values ('16794000-0000-4000-8000-000000000012','CH-S167-AVAL-2','16794000-0000-4000-8000-00000000000a','Chamado conflitante','16794000-0000-4000-8000-000000000001','16794000-0000-4000-8000-000000000022');
select throws_ok($$select pg_temp.sso_avaliar_encerramento_chamado('16794000-0000-4000-8000-00000000000a','16794000-0000-4000-8000-000000000011')$$,'23514','vinculo_legado_inconsistente','avaliação rejeita referência compartilhada');
select throws_ok($$select pg_temp.sso_diagnosticar_aptidao_chamado('16794000-0000-4000-8000-00000000000a','16794000-0000-4000-8000-000000000011')$$,'23514','vinculo_legado_inconsistente','diagnóstico rejeita referência compartilhada');
select throws_ok($$select * from pg_temp.sso_listar_itens_aptidao_chamado('16794000-0000-4000-8000-00000000000a','16794000-0000-4000-8000-000000000011','os',null,20)$$,'23514','vinculo_legado_inconsistente','lista rejeita referência compartilhada');
select ok(not has_function_privilege('authenticated','pcm.sso_exigir_vinculo_chamado_consistente(uuid,uuid)','execute'),'resolvedor privado não é executável por usuário');
select is((select habilitado from pcm.chamado_os_gate where id),false,'gate de criação fechado');
select is((select habilitado from pcm.sso_encerramento_chamado_gate where id),false,'gate de encerramento fechado');
select is((select count(*)::int from pcm.auvo_sync_outbox where row_id in ('16794000-0000-4000-8000-000000000021','16794000-0000-4000-8000-000000000022')),0,'sem outbox Auvo');
select * from finish();
rollback;
