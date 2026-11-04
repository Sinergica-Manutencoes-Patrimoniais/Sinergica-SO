-- Somente os papéis explicitamente concedidos no rollout podem executar.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(18);

select ok(to_regprocedure(f.assinatura) is not null, 'função disponível no banco: ' || f.assinatura)
from (values
  ('pcm.sso_t24_varrer_iniciadas(uuid,uuid,integer,integer)'),
  ('pcm.sso_t24_cancelar_candidata(uuid,uuid,uuid,bigint,text)'),
  ('pcm.sso_t24_iniciar_efeito(uuid,uuid,bigint)'),
  ('pcm.sso_t24_confirmar_efeito(uuid,uuid,bigint,text,jsonb)')
) as f(assinatura);

select is(has_function_privilege(r.papel, f.assinatura, 'execute'),
  (f.assinatura like '%cancelar_candidata%' and r.papel = 'authenticated') or
  (f.assinatura like '%iniciar_efeito%' and r.papel = 'service_role') or
  (f.assinatura like '%confirmar_efeito%' and r.papel = 'service_role'),
  'ACL de ' || r.papel || ' em ' || f.assinatura)
from (values
  ('pcm.sso_t24_varrer_iniciadas(uuid,uuid,integer,integer)'),
  ('pcm.sso_t24_cancelar_candidata(uuid,uuid,uuid,bigint,text)'),
  ('pcm.sso_t24_iniciar_efeito(uuid,uuid,bigint)'),
  ('pcm.sso_t24_confirmar_efeito(uuid,uuid,bigint,text,jsonb)')
) as f(assinatura)
cross join (values ('anon'), ('authenticated'), ('service_role')) as r(papel);

update pcm.sso_t24_execucao_gate set habilitado = false where id;
set local request.jwt.claims = '{"role":"service_role"}';
set local role service_role;
select throws_ok($$select pcm.sso_t24_iniciar_efeito('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',1)$$,
  '55000', 'execucao_desabilitada', 'início é recusado com gate fechado');
select throws_ok($$select pcm.sso_t24_confirmar_efeito('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',1,'123','{}'::jsonb)$$,
  '55000', 'execucao_desabilitada', 'confirmação é recusada com gate fechado');
reset role;

select * from finish();
rollback;
