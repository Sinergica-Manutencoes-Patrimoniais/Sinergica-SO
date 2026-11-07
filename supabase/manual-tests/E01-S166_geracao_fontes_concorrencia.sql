-- Somente clone sintético sso_s166_prova; fixture deve estar confirmada.
\set ON_ERROR_STOP on
begin;
set local search_path=public,extensions;
set local lock_timeout='100ms';
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(12);
select dblink_connect('s166_fonte','host=/var/run/postgresql dbname=sso_s166_prova user=supabase_admin');
select dblink_exec('s166_fonte','begin');
select dblink_exec('s166_fonte',$$set local app.auvo_sync_write='true'$$);
select dblink_exec('s166_fonte',$$set local request.jwt.claims='{"sub":"16660000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}'$$);
select dblink_exec('s166_fonte','set local role authenticated');
select * from dblink('s166_fonte',$$select pcm.sso_pcm_gerar_visita('16660000-0000-0000-0000-000000000101','16660000-0000-0000-0000-00000000000a','16660000-0000-0000-0000-000000000020','16660000-0000-0000-0000-000000000021','2026-10-05','16660000-0000-0000-0000-000000000022','2026-10-09 08:00+00',null,'Fonte sintética')$$) as t(resultado jsonb);
create function pg_temp.bloqueia(p_sql text,p_caso text) returns text language plpgsql as $$
declare estado text;
begin
 begin execute p_sql; raise exception using errcode='P0001', message='mutação não bloqueou';
 exception when others then estado:=sqlstate; end;
 return extensions.is(estado,'55P03',p_caso);
end $$;
select pg_temp.bloqueia($q$delete from config.sso_concessoes where usuario_id='16660000-0000-0000-0000-000000000001' and acao='plano.gerir'$q$,'concessão permanece estável até commit');
select pg_temp.bloqueia('update pcm.sso_acesso_geracao_visita_gate set habilitado=false where id','gate de acesso permanece estável');
select pg_temp.bloqueia('update pcm.sso_gerar_visita_contratual_gate set habilitado=false where id','gate de geração permanece estável');
select pg_temp.bloqueia('update pcm.feriado_declarado_gate set habilitado=false where id','gate de feriado permanece estável');
select pg_temp.bloqueia('update pcm.sso_origem_contratual_unica_gate set habilitado=false where id','gate de origem permanece estável');
select pg_temp.bloqueia($q$insert into pcm.feriados_declarados(id,cliente_id,data,fonte,motivo,criado_por) values ('16660000-0000-0000-0000-000000000040','16660000-0000-0000-0000-00000000000a','2026-10-09','fonte','teste','16660000-0000-0000-0000-000000000001')$q$,'declaração concorrente de feriado aguarda');
select dblink_exec('s166_fonte','rollback');
create function pg_temp.inverso(p_sql text,p_caso text) returns text language plpgsql as $test$
declare estado text;
begin
 perform extensions.dblink_exec('s166_fonte','begin');
 perform extensions.dblink_exec('s166_fonte',p_sql);
 perform set_config('request.jwt.claims','{"sub":"16660000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
 execute 'set local role authenticated';
 begin
  perform pcm.sso_pcm_gerar_visita('16660000-0000-0000-0000-000000000101','16660000-0000-0000-0000-00000000000a','16660000-0000-0000-0000-000000000020','16660000-0000-0000-0000-000000000021','2026-10-05','16660000-0000-0000-0000-000000000022','2026-10-09 08:00+00',null,'Fonte sintética');
  raise exception using errcode='P0001',message='geração não bloqueou';
 exception when others then estado:=sqlstate; end;
 execute 'reset role';
 perform extensions.dblink_exec('s166_fonte','rollback');
 return extensions.is(estado,'55P03',p_caso);
end $test$;
select pg_temp.inverso($q$delete from config.sso_concessoes where usuario_id='16660000-0000-0000-0000-000000000001' and acao='plano.gerir'$q$,'concessão primeiro recusa geração');
select pg_temp.inverso('update pcm.sso_acesso_geracao_visita_gate set habilitado=false where id','gate de acesso primeiro recusa geração');
select pg_temp.inverso('update pcm.sso_gerar_visita_contratual_gate set habilitado=false where id','gate de geração primeiro recusa geração');
select pg_temp.inverso('update pcm.feriado_declarado_gate set habilitado=false where id','gate de feriado primeiro recusa geração');
select pg_temp.inverso('update pcm.sso_origem_contratual_unica_gate set habilitado=false where id','gate de origem primeiro recusa geração');
select pg_temp.inverso($q$insert into pcm.feriados_declarados(id,cliente_id,data,fonte,motivo,criado_por) values ('16660000-0000-0000-0000-000000000040','16660000-0000-0000-0000-00000000000a','2026-10-09','fonte','teste','16660000-0000-0000-0000-000000000001')$q$,'feriado primeiro recusa geração');
select dblink_disconnect('s166_fonte');
select * from finish();
rollback;
