-- kits_atomicidade.test.sql — pgTAP (E01-S66, AC-1 a AC-3)
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kits-escrita-s66@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000602","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';

-- Ferramenta A (2 unidades disponíveis) + Ferramenta B (0 unidades — vai faltar).
insert into pcm.ferramentas (id, nome, quantidade_total, quantidade_minima, created_by, updated_by)
values
  ('60000000-0000-0000-0000-000000000001', 'Ferramenta A S66', 2, 0, '00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000602'),
  ('60000000-0000-0000-0000-000000000002', 'Ferramenta B S66', 1, 0, '00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000602');
insert into pcm.ferramenta_unidades (id, ferramenta_id, created_by, updated_by)
values
  ('60000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000602'),
  ('60000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000602');
-- Ferramenta B fica SEM unidade nenhuma de propósito (o kit vai pedir 1, não vai ter).
insert into pcm.funcionarios (id, nome, created_by, updated_by)
values ('60000000-0000-0000-0000-000000000005', 'Técnico S66', '00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000602');

insert into pcm.kits (id, nome, created_by, updated_by)
values ('60000000-0000-0000-0000-000000000006', 'Kit S66', '00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000602');
insert into pcm.kit_itens (kit_id, ferramenta_id, quantidade, created_by)
values
  ('60000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000001', 2, '00000000-0000-0000-0000-000000000602'),
  ('60000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000002', 1, '00000000-0000-0000-0000-000000000602');

-- AC-2: kit incompleto (falta unidade de Ferramenta B) — atribuição inteira falha.
select throws_ok(
  $$ select pcm.fn_atribuir_kit('60000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000602') $$,
  'P0001',
  null,
  'atribuir kit incompleto falha (falta unidade de 1 item)'
);

-- Tudo-ou-nada: as 2 unidades de Ferramenta A NÃO devem ter sido atribuídas na tentativa que falhou.
select is(
  (select count(*)::int from pcm.ferramenta_unidades where ferramenta_id = '60000000-0000-0000-0000-000000000001' and status = 'disponivel'),
  2,
  'tudo-ou-nada: nenhuma unidade de A ficou atribuida apos falha no item B'
);
select is(
  (select count(*)::int from pcm.ferramenta_movimentacoes where unidade_id in ('60000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000004')),
  0,
  'tudo-ou-nada: nenhuma movimentacao foi gravada pras unidades de A'
);

-- Completa o estoque de B e tenta de novo — agora deve funcionar.
insert into pcm.ferramenta_unidades (id, ferramenta_id, created_by, updated_by)
values ('60000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000602');

select lives_ok(
  $$ select pcm.fn_atribuir_kit('60000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000602') $$,
  'kit completo (estoque OK) atribui com sucesso'
);
select is(
  (select count(*)::int from pcm.ferramenta_unidades where status = 'atribuida' and ferramenta_id in ('60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002')),
  3,
  'as 3 unidades do kit (2 de A + 1 de B) ficaram atribuidas'
);

-- AC-3: devolve o kit inteiro numa chamada só.
select lives_ok(
  $$ select pcm.fn_devolver_kit((select kit_atribuicao_id from pcm.ferramenta_movimentacoes where unidade_id = '60000000-0000-0000-0000-000000000007' and tipo = 'atribuicao' limit 1), 'ok', '00000000-0000-0000-0000-000000000602') $$,
  'devolver kit em lote roda sem erro'
);
select is(
  (select count(*)::int from pcm.ferramenta_unidades where status = 'disponivel' and ferramenta_id in ('60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002')),
  3,
  'as 3 unidades voltaram a disponivel apos devolver o kit'
);
select is(
  (select count(*)::int from pcm.ferramenta_unidades where status = 'atribuida' and ferramenta_id in ('60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002')),
  0,
  'nenhuma unidade do kit ficou atribuida apos a devolucao'
);

reset role;
select * from finish();
rollback;
