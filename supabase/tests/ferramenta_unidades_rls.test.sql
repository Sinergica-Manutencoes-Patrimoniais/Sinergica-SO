-- ferramenta_unidades_rls.test.sql — pgTAP (E01-S63, AC-1 a AC-7)
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ferr-unid-leitura-s63@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ferr-unid-escrita-s63@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000402","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';

insert into pcm.ferramentas (id, nome, quantidade_total, quantidade_minima, created_by, updated_by)
values ('40000000-0000-0000-0000-000000000001', 'Furadeira S63', 2, 0, '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000402');

insert into pcm.funcionarios (id, nome, created_by, updated_by)
values ('40000000-0000-0000-0000-000000000002', 'Técnico S63', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000402');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000401","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok(
  $$ insert into pcm.ferramenta_unidades (ferramenta_id, created_by) values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000401') $$,
  '42501',
  null,
  'pcm leitura NAO cria unidade de ferramenta'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000402","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.ferramenta_unidades (id, ferramenta_id, created_by, updated_by) values ('40000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000402') $$,
  'pcm escrita cria unidade de ferramenta'
);
select isnt(
  (select codigo from pcm.ferramenta_unidades where id = '40000000-0000-0000-0000-000000000003'),
  null,
  'codigo da unidade eh gerado automaticamente (sequencia FER-NNNN)'
);
select is(
  (select status from pcm.ferramenta_unidades where id = '40000000-0000-0000-0000-000000000003'),
  'disponivel',
  'unidade nasce disponivel'
);

-- AC-2: atribuição grava movimentação e a unidade passa a atribuida.
select lives_ok(
  $$ insert into pcm.ferramenta_movimentacoes (unidade_id, tipo, funcionario_id, created_by) values ('40000000-0000-0000-0000-000000000003', 'atribuicao', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000402') $$,
  'pcm escrita atribui unidade disponivel'
);
select is(
  (select status from pcm.ferramenta_unidades where id = '40000000-0000-0000-0000-000000000003'),
  'atribuida',
  'trigger aplica atribuicao — status vira atribuida'
);

-- AC-2 (invariante): não pode atribuir de novo uma unidade já atribuída.
select throws_ok(
  $$ insert into pcm.ferramenta_movimentacoes (unidade_id, tipo, funcionario_id, created_by) values ('40000000-0000-0000-0000-000000000003', 'atribuicao', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000402') $$,
  'P0001',
  null,
  'nao atribui unidade que ja esta atribuida (1 atribuicao ativa por vez)'
);

-- AC-3: devolução em condição OK volta a disponível.
select lives_ok(
  $$ insert into pcm.ferramenta_movimentacoes (unidade_id, tipo, condicao, created_by) values ('40000000-0000-0000-0000-000000000003', 'devolucao', 'ok', '00000000-0000-0000-0000-000000000402') $$,
  'pcm escrita devolve unidade atribuida'
);
select is(
  (select status from pcm.ferramenta_unidades where id = '40000000-0000-0000-0000-000000000003'),
  'disponivel',
  'trigger aplica devolucao OK — status volta pra disponivel'
);

-- AC-4/AC-6: append-only — nenhuma movimentação pode ser alterada ou apagada, mesmo por quem
-- escreveu (histórico nunca some).
select throws_ok(
  $$ update pcm.ferramenta_movimentacoes set motivo = 'editado' where unidade_id = '40000000-0000-0000-0000-000000000003' $$,
  '42501',
  null,
  'ferramenta_movimentacoes eh append-only — UPDATE negado'
);
select throws_ok(
  $$ delete from pcm.ferramenta_movimentacoes where unidade_id = '40000000-0000-0000-0000-000000000003' $$,
  '42501',
  null,
  'ferramenta_movimentacoes eh append-only — DELETE negado'
);

reset role;
select * from finish();
rollback;
