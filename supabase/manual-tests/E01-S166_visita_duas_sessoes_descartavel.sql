-- SOMENTE cluster descartável, cron desativado e sem portas. 1009 e fixture
-- sintética de E01-S166_acesso_geracao_visita devem estar confirmadas no clone.
set search_path=public,extensions;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(7);
select dblink_connect('s166_a','dbname=postgres user=supabase_admin');
select dblink_connect('s166_admin','dbname=postgres user=supabase_admin');
select dblink_exec('s166_a',$$set request.jwt.claims = '{"sub":"16660000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}'$$);
select dblink_exec('s166_a',$$set application_name = 's166-concorrencia'$$);
set request.jwt.claims = '{"sub":"16660000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
create temporary table s166_resultados(resultado jsonb);
create temporary table s166_antes as select (select count(*) from pcm.ordens_servico) os,(select count(*) from pcm.auvo_sync_outbox) outbox;
begin;
insert into s166_resultados select pcm.sso_pcm_gerar_visita('16660000-0000-0000-0000-000000000101','16660000-0000-0000-0000-00000000000a','16660000-0000-0000-0000-000000000020','16660000-0000-0000-0000-000000000021','2026-10-05','16660000-0000-0000-0000-000000000022','2026-10-09 08:00+00',null,'Fonte sintética');
select dblink_send_query('s166_a',$$select pcm.sso_pcm_gerar_visita('16660000-0000-0000-0000-000000000101','16660000-0000-0000-0000-00000000000a','16660000-0000-0000-0000-000000000020','16660000-0000-0000-0000-000000000021','2026-10-05','16660000-0000-0000-0000-000000000022','2026-10-09 08:00+00',null,'Fonte sintética')$$);
select pg_sleep(0.2);
select ok(dblink_is_busy('s166_a')=1 and exists(select 1 from pg_stat_activity where application_name='s166-concorrencia' and wait_event_type='Lock'),'replay concorrente aguarda lock da transação criadora');
commit;
insert into s166_resultados select resultado from dblink_get_result('s166_a') as t(resultado jsonb);
select is((select count(distinct resultado)::int from s166_resultados),1,'replay concorrente devolve resultado original');
select is((select count(*)::int from pcm.visita_origem_contratual where visita_id='16660000-0000-0000-0000-000000000022'),1,'origem única preservada');
select is((select count(*)::int from pcm.visitas where id='16660000-0000-0000-0000-000000000022'),1,'Visita única preservada');
select * from dblink_get_result('s166_a') as t(resultado jsonb);
-- Segura a série para que a segunda sessão valide permissões e espere no lock;
-- revogação ocorre por terceira conexão antes de liberar o lock.
begin;
select id from pcm.calendario_contratual_series where id='16660000-0000-0000-0000-000000000020' for update;
select dblink_send_query('s166_a',$$select pcm.sso_pcm_gerar_visita('16660000-0000-0000-0000-000000000102','16660000-0000-0000-0000-00000000000a','16660000-0000-0000-0000-000000000020','16660000-0000-0000-0000-000000000021','2026-10-12','16660000-0000-0000-0000-000000000023','2026-10-16 08:00+00',null,'Fonte sintética')$$);
select pg_sleep(0.2);
select ok(dblink_is_busy('s166_a')=1 and exists(select 1 from pg_stat_activity where application_name='s166-concorrencia' and wait_event_type='Lock'),'gerador aguarda lock da série antes da revogação');
select dblink_exec('s166_admin',$$delete from config.sso_concessoes where usuario_id='16660000-0000-0000-0000-000000000001' and acao='visita.confirmar'$$);
commit;
select throws_ok($$select * from dblink_get_result('s166_a') as t(resultado jsonb)$$,'42501',null,'revogação concorrente impede geração após espera');
select ok((select count(*) from pcm.visitas where id='16660000-0000-0000-0000-000000000023')=0 and (select count(*) from pcm.ordens_servico)=(select os from s166_antes) and (select count(*) from pcm.auvo_sync_outbox)=(select outbox from s166_antes),'revogação não cria Visita, OS ou outbox');
select * from finish();
select dblink_disconnect('s166_a');
select dblink_disconnect('s166_admin');
