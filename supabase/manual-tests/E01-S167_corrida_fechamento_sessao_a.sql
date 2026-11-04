-- Sessão A, apenas em cluster descartável. Gate permanece fechado; clones privados.
begin;
set local app.auvo_sync_write='true';
select set_config('request.jwt.claims','{"sub":"16796000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
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
select pg_temp.sso_encerrar_chamado_conferido('16796000-0000-4000-8000-000000000041','16796000-0000-4000-8000-00000000000a','16796000-0000-4000-8000-000000000011',(select sso_revisao from pcm.chamados where id='16796000-0000-4000-8000-000000000011'),'Conferência sintética');
select pg_sleep(12);
commit;
