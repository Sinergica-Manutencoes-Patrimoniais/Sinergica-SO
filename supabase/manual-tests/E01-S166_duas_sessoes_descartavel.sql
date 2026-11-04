-- SOMENTE CLUSTER DESCARTÁVEL: exige 1002 e fixture E01-S166_criacao_replay
-- confirmadas previamente nesse cluster, sem cron, portas ou acesso externo.
set search_path = public, extensions;
set timezone = 'UTC';
create extension if not exists dblink with schema extensions;
select plan(7);
select dblink_connect('s166_segunda', 'dbname=postgres user=supabase_admin');
select dblink_exec('s166_segunda', $$set request.jwt.claims = '{"sub":"16650000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}'$$);
select dblink_exec('s166_segunda', $$set timezone = 'UTC'$$);
set request.jwt.claims = '{"sub":"16650000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
create temporary table s166_duas_resultados(resultado jsonb);
create temporary table s166_duas_antes as select (select count(*) from pcm.ordens_servico) os,(select count(*) from pcm.auvo_sync_outbox) outbox;
begin;
insert into s166_duas_resultados select pcm.sso_materializar_ciclo_canonico('16650000-0000-0000-0000-000000000101','16650000-0000-0000-0000-00000000000a','16650000-0000-0000-0000-000000000021','16650000-0000-0000-0000-000000000022','16650000-0000-0000-0000-000000000023',1,current_date);
select throws_ok($test$select * from dblink('s166_segunda', $$select pcm.sso_materializar_ciclo_canonico('16650000-0000-0000-0000-000000000101','16650000-0000-0000-0000-00000000000a','16650000-0000-0000-0000-000000000021','16650000-0000-0000-0000-000000000022','16650000-0000-0000-0000-000000000023',1,current_date)$$) as t(resultado jsonb)$test$,'55P03',null,'segunda sessão recusa imediatamente enquanto primeira detém lock');
commit;
insert into s166_duas_resultados select resultado from dblink('s166_segunda', $$select pcm.sso_materializar_ciclo_canonico('16650000-0000-0000-0000-000000000101','16650000-0000-0000-0000-00000000000a','16650000-0000-0000-0000-000000000021','16650000-0000-0000-0000-000000000022','16650000-0000-0000-0000-000000000023',1,current_date)$$) as t(resultado jsonb);
select is((select count(distinct resultado)::int from s166_duas_resultados),1,'replay em outra sessão devolve resultado original');
select is((select count(*)::int from pcm.ocorrencias_rotina_preparadas where plano_id='16650000-0000-0000-0000-000000000021'),1,'uma ocorrência preparada após replay');
select is((select count(*)::int from pcm.sso_ciclo_canonico_usos_versao where versao_id='16650000-0000-0000-0000-000000000022'),1,'um uso canônico');
select is((select count(*)::int from pcm.calendario_contratual_comandos where request_id='16650000-0000-0000-0000-000000000101'),1,'um comando para o request');
select ok((select bool_and((resultado->>'criada')::boolean and not (resultado->>'osCriada')::boolean and not (resultado->>'tarefaAuvoCriada')::boolean) from s166_duas_resultados),'resultado indica criação sem OS ou Auvo');
select ok((select count(*) from pcm.ordens_servico)=(select os from s166_duas_antes) and (select count(*) from pcm.auvo_sync_outbox)=(select outbox from s166_duas_antes),'OS e outbox não são alteradas');
select * from finish();
select dblink_disconnect('s166_segunda');
