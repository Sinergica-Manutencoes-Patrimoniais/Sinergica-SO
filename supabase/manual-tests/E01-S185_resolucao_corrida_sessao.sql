-- Executar duas sessões com variáveis psql conflito, os, task, request, atraso.
-- Clona somente a função e ignora sua verificação de gate apenas na cópia temporária.
begin;
select set_config('request.jwt.claims','{"sub":"18594000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
do $test$
declare v_original text; v_copia text;
begin
 select pg_get_functiondef('pcm.sso_resolver_conflito_webhook_chamado(uuid,uuid,uuid,timestamptz,bigint,text,boolean)'::regprocedure) into v_original;
 v_copia:=replace(v_original,'FUNCTION pcm.sso_resolver_conflito_webhook_chamado(', 'FUNCTION pg_temp.sso_resolver_conflito_webhook_chamado(');
 v_copia:=replace(v_copia,'if not coalesce((select habilitado from pcm.sso_resolucao_conflito_webhook_gate where id),false) then','if false then');
 if position('if false then' in v_copia)=0 then raise exception 'cópia de teste inválida'; end if;
 execute v_copia;
end $test$;
select pg_temp.sso_resolver_conflito_webhook_chamado(:'request'::uuid,'18594000-0000-4000-8000-00000000000a',:'conflito'::uuid,(select coalesce(updated_at,created_at) from pcm.ordens_servico where id=:'os'::uuid),:'task'::bigint,'em_execucao',true);
select pg_sleep(:'atraso'::integer);
commit;
