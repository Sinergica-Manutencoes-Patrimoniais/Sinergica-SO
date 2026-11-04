-- Apenas sso_s166_triagem_prova, clone sintético, com fixtures e gate de teste.
\set ON_ERROR_STOP on
begin;
set local search_path=public,extensions;
set local lock_timeout='100ms';
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(4);
select dblink_connect('triagem','host=/var/run/postgresql dbname=sso_s166_triagem_prova user=supabase_admin');
select dblink_exec('triagem','begin');
select dblink_exec('triagem',$$set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}'$$);
select dblink_exec('triagem','set local role authenticated');
select * from dblink('triagem',$$select pcm.sso_triar_ciclo_atrasado('16891000-0000-4000-8000-000000000090','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015',0,'2026-02-01','avaliar','Conferido')$$) as t(resultado jsonb);
create function pg_temp.mutacao(p_sql text,p_nome text) returns text language plpgsql as $$
declare estado text;
begin
 begin execute p_sql; raise exception using errcode='P0001',message='mudança não aguardou';
 exception when others then estado:=sqlstate; end;
 return extensions.is(estado,'55P03',p_nome);
end $$;
select pg_temp.mutacao($q$delete from config.sso_concessoes where usuario_id='16891000-0000-4000-8000-000000000001' and acao='plano.gerir'$q$,'concessão protegida até commit');
select pg_temp.mutacao('update pcm.sso_triagem_atraso_gate set habilitado=false where id','gate protegido até commit');
select dblink_exec('triagem','rollback');
select dblink_exec('triagem','begin');
select dblink_exec('triagem',$q$delete from config.sso_concessoes where usuario_id='16891000-0000-4000-8000-000000000001' and acao='plano.gerir'$q$);
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
create function pg_temp.tentar(p_nome text) returns text language plpgsql as $$
declare estado text;
begin
 begin
  perform pcm.sso_triar_ciclo_atrasado('16891000-0000-4000-8000-000000000090','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015',0,'2026-02-01','avaliar','Conferido');
  raise exception using errcode='P0001',message='triagem não recusou';
 exception when others then estado:=sqlstate; end;
 return extensions.is(estado,'55P03',p_nome);
end $$;
set local role authenticated;
select pg_temp.tentar('revogação concorrente impede triagem');
reset role;
select dblink_exec('triagem','rollback');
select dblink_exec('triagem','begin');
select dblink_exec('triagem','update pcm.sso_triagem_atraso_gate set habilitado=false where id');
set local role authenticated;
select pg_temp.tentar('fechamento concorrente do gate impede triagem');
reset role;
select dblink_exec('triagem','rollback');
select dblink_disconnect('triagem');
select * from finish();
rollback;
