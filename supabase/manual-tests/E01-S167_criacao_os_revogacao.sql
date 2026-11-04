-- Banco isolado apenas. Outra sessão mantém o lock exclusivo da autorização.
-- Migration pode ser concatenada antes deste roteiro na mesma transação.
-- Sessão 1: docker exec sso_diagnostico_reconstrucao psql -U supabase_admin -d postgres
--   BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('sso-autorizacao-confirmacao-visita',0));
--   Manter sessão aberta até terminar sessão 2, depois ROLLBACK.
-- Sessão 2, na raiz do repositório:
--   awk 'BEGIN {print "begin;"} {print}' supabase/migrations/1020_E01-S167_serializar_autorizacao_criacao_os.sql supabase/manual-tests/E01-S167_criacao_os_revogacao.sql | docker exec -i sso_diagnostico_reconstrucao psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1
-- Conferir todos os resultados pgTAP: exit code 0 de psql não prova ausência de "not ok".
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(4);
do $test$
declare v_original text; v_copia text;
begin
  select pg_get_functiondef('pcm.sso_criar_os_chamado(uuid,bigint,uuid,uuid,uuid,text,text,text)'::regprocedure) into v_original;
  v_copia:=replace(v_original,'FUNCTION pcm.sso_criar_os_chamado(', 'FUNCTION pg_temp.sso_criar_os_chamado(');
  -- Substitui os dois bloqueios preexistentes APENAS na cópia, preservando a
  -- guarda nova e o corpo restante. Nenhum parâmetro válido será fornecido.
  v_copia:=regexp_replace(v_copia,
    '  if not coalesce\(\(select habilitado from pcm.chamado_os_gate where id\), false\) then.*?  end if;\n  if pg_catalog.to_regclass.*?  end if;',
    '', 's');
  if v_copia=v_original or position('transicao_legada_incompleta' in v_copia)>0
    or position('criacao_multipla_bloqueada' in v_copia)>0 then
    raise exception 'cópia de teste não pôde ser construída';
  end if;
  execute v_copia;
end $test$;
select throws_ok($$select pg_temp.sso_criar_os_chamado(null,null,null,null,null,null,null,null)$$,
  '55P03','autorizacao_em_alteracao','revogação em curso impede prosseguimento da cópia');
select is((select habilitado from pcm.chamado_os_gate where id),false,'gate real permanece fechado');
select throws_ok($$select pcm.sso_criar_os_chamado(null,null,null,null,null,null,null,null)$$,
  '55000','criacao_multipla_bloqueada','comando real continua bloqueado');
select ok(not has_function_privilege('authenticated','pcm.sso_criar_os_chamado(uuid,bigint,uuid,uuid,uuid,text,text,text)','execute')
  and not has_function_privilege('anon','pcm.sso_criar_os_chamado(uuid,bigint,uuid,uuid,uuid,text,text,text)','execute')
  and not has_function_privilege('service_role','pcm.sso_criar_os_chamado(uuid,bigint,uuid,uuid,uuid,text,text,text)','execute'),
  'ACL continua sem EXECUTE para papéis externos');
select * from finish();
rollback;
