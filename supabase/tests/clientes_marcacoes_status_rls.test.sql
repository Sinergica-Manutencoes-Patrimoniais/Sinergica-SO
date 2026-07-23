-- clientes_marcacoes_status_rls.test.sql — pgTAP (E01-S91, AC-1/2)
-- Prova permissões do catálogo, vínculo único e bloqueio de exclusão em uso.

begin;
select plan(9);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marcacao-leitura-s91@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000092', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marcacao-escrita-s91@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000091","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';

select ok(
  (select count(*) from pcm.marcacoes_cliente) >= 3,
  'pcm leitura enxerga catálogo e seeds (AC-1)'
);
select throws_ok(
  $$ insert into pcm.marcacoes_cliente (nome, cor) values ('[TESTE] Negada S91', '#111111') $$,
  '42501', null,
  'pcm leitura NAO cria marcação'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000092","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';

select lives_ok(
  $$ insert into pcm.marcacoes_cliente (id, nome, cor, created_by) values ('91000000-0000-0000-0000-000000000001', '[TESTE] S91 A', '#123456', '00000000-0000-0000-0000-000000000092') $$,
  'pcm escrita cria marcação (AC-1)'
);
select lives_ok(
  $$ insert into pcm.marcacoes_cliente (id, nome, cor, created_by) values ('91000000-0000-0000-0000-000000000002', '[TESTE] S91 B', '#654321', '00000000-0000-0000-0000-000000000092') $$,
  'pcm escrita cria segunda marcação'
);
select lives_ok(
  $$ insert into pcm.clientes (id, nome, marcacao_id, created_by, updated_by) values ('91000000-0000-0000-0000-000000000003', '[TESTE] Cliente S91', '91000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000092', '00000000-0000-0000-0000-000000000092') $$,
  'cliente recebe uma marcação (AC-2)'
);
select lives_ok(
  $$ update pcm.clientes set marcacao_id = '91000000-0000-0000-0000-000000000002', updated_by = '00000000-0000-0000-0000-000000000092' where id = '91000000-0000-0000-0000-000000000003' $$,
  'trocar marcação substitui vínculo vigente (AC-2)'
);
select is(
  (select marcacao_id from pcm.clientes where id = '91000000-0000-0000-0000-000000000003'),
  '91000000-0000-0000-0000-000000000002'::uuid,
  'cliente mantém exatamente a marcação nova'
);
select lives_ok(
  $$ delete from pcm.marcacoes_cliente where id = '91000000-0000-0000-0000-000000000001' $$,
  'marcação sem uso pode ser excluída'
);
select throws_ok(
  $$ delete from pcm.marcacoes_cliente where id = '91000000-0000-0000-0000-000000000002' $$,
  '23503', null,
  'FK bloqueia excluir marcação em uso'
);

reset role;
select * from finish();
rollback;
