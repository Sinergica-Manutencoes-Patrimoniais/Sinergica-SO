-- rentabilidade_horas_auvo.test.sql — pgTAP (DEF-06)
-- `auvo_detalhes -> duracaoHoras` é texto livre vindo do Auvo. Antes do fix, uma única OS
-- finalizada com texto não numérico abortava fn_rentabilidade_cliente_mes inteira com 22P02
-- ("invalid input syntax for type numeric") e a tela de Rentabilidade não carregava para
-- nenhum cliente. Rodar com `supabase test db`.

begin;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rentab-def06@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, created_by)
values ('66660000-0000-4000-8000-000000000601', 'DEF-06 cliente de teste', '00000000-0000-0000-0000-000000000601')
on conflict (id) do nothing;

insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, status, prioridade, origem, created_by, data_agendada, auvo_detalhes)
values
  ('66660000-0000-4000-8000-000000000611', '66660000-0000-4000-8000-000000000601', 'DEF06-1', 'decimal com virgula', 'corretiva', 'finalizado', 'normal', 'manual', '00000000-0000-0000-0000-000000000601', current_date, '{"duracaoHoras":"2,5"}'::jsonb),
  ('66660000-0000-4000-8000-000000000612', '66660000-0000-4000-8000-000000000601', 'DEF06-2', 'texto vazio', 'corretiva', 'finalizado', 'normal', 'manual', '00000000-0000-0000-0000-000000000601', current_date, '{"duracaoHoras":""}'::jsonb),
  ('66660000-0000-4000-8000-000000000613', '66660000-0000-4000-8000-000000000601', 'DEF06-3', 'valor valido', 'corretiva', 'finalizado', 'normal', 'manual', '00000000-0000-0000-0000-000000000601', current_date, '{"duracaoHoras":"3.5"}'::jsonb)
on conflict (id) do nothing;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000601","role":"authenticated","user_role":"superadmin"}',
  true
);

-- O extrator sozinho: válido lê, inválido e ausente viram 0 hora (mesmo tratamento).
select is(financeiro._fn_horas_auvo('{"duracaoHoras":"3.5"}'::jsonb), 3.5, 'duracaoHoras numerico e lido');
select is(financeiro._fn_horas_auvo('{"duracaoHoras":"2,5"}'::jsonb), 0::numeric, 'decimal com virgula nao aborta e conta 0 hora');
select is(financeiro._fn_horas_auvo('{"duracaoHoras":""}'::jsonb), 0::numeric, 'texto vazio conta 0 hora');
select is(financeiro._fn_horas_auvo('{}'::jsonb), 0::numeric, 'chave ausente conta 0 hora, como antes');

-- A RPC da tela não pode mais abortar por causa de uma OS com texto ruim.
select lives_ok(
  $$ select * from financeiro.fn_rentabilidade_cliente_mes(12) $$,
  'fn_rentabilidade_cliente_mes nao aborta com duracaoHoras nao numerico (DEF-06)'
);

select is(
  (select horas_totais from financeiro.fn_rentabilidade_cliente_mes(12)
    where cliente_id = '66660000-0000-4000-8000-000000000601'),
  3.5,
  'soma de horas considera so a OS com duracaoHoras numerico'
);

-- O drill-down por OS (AC-5) faz o mesmo cast e cai pelo mesmo motivo.
select lives_ok(
  $$ select * from financeiro.fn_custo_os_por_cliente_mes('66660000-0000-4000-8000-000000000601', current_date) $$,
  'fn_custo_os_por_cliente_mes nao aborta com duracaoHoras nao numerico (DEF-06)'
);

select * from finish();
rollback;
