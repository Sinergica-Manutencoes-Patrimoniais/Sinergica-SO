-- financeiro_rentabilidade_rls.test.sql — pgTAP (E04-S06, AC-1/AC-2)
-- RLS de financeiro.custos_funcionario + guarda manual de financeiro:leitura nas RPCs security
-- definer de rentabilidade. Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000441', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-sem-modulo-s06@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000442', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-escrita-s06@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000441","user_role":"colaborador","user_modulos":{}}';
select throws_ok(
  $$ select * from financeiro.fn_rentabilidade_cliente_mes(12) $$,
  '42501',
  'permission denied for function fn_rentabilidade_cliente_mes',
  'sem modulo financeiro: fn_rentabilidade_cliente_mes nega (security definer + guarda manual)'
);

select throws_ok(
  $$ insert into financeiro.custos_funcionario (funcionario_id, custo_mensal_centavos, vigente_desde)
     select id, 500000, current_date from pcm.funcionarios limit 1 $$,
  '42501',
  null,
  'sem modulo financeiro NAO insere custo de funcionario'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000442","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
select lives_ok(
  $$ select * from financeiro.fn_rentabilidade_cliente_mes(12) $$,
  'escrita financeiro consegue chamar fn_rentabilidade_cliente_mes'
);

select lives_ok(
  $$ select * from financeiro.fn_custo_os_por_cliente_mes(gen_random_uuid(), current_date) $$,
  'escrita financeiro consegue chamar fn_custo_os_por_cliente_mes (cliente inexistente: 0 linhas, sem erro)'
);

reset role;
select * from finish();
rollback;
