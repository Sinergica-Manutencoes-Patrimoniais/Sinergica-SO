-- Apenas clone sintético sso_s166_feriado_prova; não executar em produção.
\set ON_ERROR_STOP on
begin;
set local search_path=public,extensions;
set local lock_timeout='100ms';
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(8);
select dblink_connect('feriado','host=/var/run/postgresql dbname=sso_s166_feriado_prova user=supabase_admin');
create function pg_temp.verificar(p_sql text,p_caso text) returns setof text language plpgsql as $test$
declare estado text;
begin
 perform extensions.dblink_exec('feriado','begin');
 perform extensions.dblink_exec('feriado',$$set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}'$$);
 perform extensions.dblink_exec('feriado','set local role authenticated');
 perform 1 from extensions.dblink('feriado',$$select pcm.sso_decidir_feriado_calendario('16891000-0000-4000-8000-000000000090','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015','16891000-0000-4000-8000-000000000091',0,'PCM conferiu')$$) as t(resultado jsonb);
 begin execute p_sql; raise exception using errcode='P0001',message='alteração não bloqueou';
 exception when others then estado:=sqlstate; end;
 return next extensions.is(estado,'55P03','decisão primeiro: '||p_caso);
 perform extensions.dblink_exec('feriado','rollback');
 perform extensions.dblink_exec('feriado','begin');
 perform extensions.dblink_exec('feriado',p_sql);
 perform set_config('request.jwt.claims','{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
 execute 'set local role authenticated';
 begin
  perform pcm.sso_decidir_feriado_calendario('16891000-0000-4000-8000-000000000090','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015','16891000-0000-4000-8000-000000000091',0,'PCM conferiu');
  raise exception using errcode='P0001',message='decisão não bloqueou';
 exception when others then estado:=sqlstate; end;
 execute 'reset role';
 return next extensions.is(estado,'55P03','alteração primeiro: '||p_caso);
 perform extensions.dblink_exec('feriado','rollback');
 return;
end $test$;
select pg_temp.verificar(p_sql,p_caso) from (values
 ($q$delete from config.sso_concessoes where usuario_id='16891000-0000-4000-8000-000000000001' and acao='plano.gerir'$q$,'autorização'),
 ('update pcm.sso_decisao_feriado_calendario_gate set habilitado=false where id','gate de decisão'),
 ('update pcm.feriado_declarado_gate set habilitado=false where id','gate de feriado'),
 ($q$update pcm.feriados_declarados set ativo=false where id='16891000-0000-4000-8000-000000000091'$q$,'feriado declarado')
) t(p_sql,p_caso);
select dblink_disconnect('feriado');
select * from finish();
rollback;
