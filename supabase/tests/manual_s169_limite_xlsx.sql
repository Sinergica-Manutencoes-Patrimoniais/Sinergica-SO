-- Somente banco descartável: funções e tabela extraídas da migration 0146; auth.role é fixture.
\set ON_ERROR_STOP on
begin;
grant usage on schema atendimento to service_role, authenticated;
grant usage on schema auth to service_role, authenticated;
set local test.role='service_role';
set local role service_role;
do $$ declare i integer; begin
 for i in 1..10 loop
  if atendimento.fn_consumir_rate_limit_webhook('xlsx-cronograma:16891000-0000-4000-8000-000000000001',10,60) is distinct from true then raise exception 'limite antecipado'; end if;
 end loop;
 if atendimento.fn_consumir_rate_limit_webhook('xlsx-cronograma:16891000-0000-4000-8000-000000000001',10,60) is distinct from false then raise exception 'limite não aplicado'; end if;
 if atendimento.fn_consumir_rate_limit_webhook('xlsx-cronograma:16891000-0000-4000-8000-000000000002',10,60) is distinct from true then raise exception 'usuário afetado por limite alheio'; end if;
end$$;
reset role;
set local test.role='authenticated';
set local role authenticated;
do $$begin
 begin perform atendimento.fn_consumir_rate_limit_webhook('xlsx-cronograma:teste',10,60); raise exception 'usuário acessou limitador'; exception when insufficient_privilege then null; end;
end$$;
rollback;
