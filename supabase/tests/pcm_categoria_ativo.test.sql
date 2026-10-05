-- pcm_categoria_ativo.test.sql — pgTAP (E01-S156 AC-2..AC-5)
-- Roda no job db-tests; esta máquina não tem Docker/Supabase local.

begin;
select plan(13);

select has_column('pcm', 'equipamento_categorias', 'sigla', 'AC-2: catálogo tem sigla');
select has_column('pcm', 'equipamentos', 'categoria_id', 'AC-4: Componente aponta para categoria');
select has_column('pcm', 'sistemas', 'categoria_id', 'AC-4: Sistema aponta para categoria');
select has_column('pcm', 'sistemas', 'categoria', 'AC-4: Sistema preserva texto para Auvo');
select is(
  (select count(*)::int from pcm.equipamento_categorias
    where (nome, sigla) in (
      ('Elétrica', 'ELE'), ('Hidráulica', 'HID'), ('Transporte Vertical', 'TRV'),
      ('Climatização', 'CLI'), ('Segurança', 'SEG'), ('PCI (Prevenção e Combate a Incêndio)', 'PCI')
    ) and deleted_at is null),
  6,
  'AC-3: seis categorias semente com sigla existem'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000162', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'categoria-s156@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- auth.users é gerenciada pelo Supabase: o papel de aplicação service_role não
-- recebe escrita direta nela. A fixture é criada pelo dono do banco antes de
-- assumir o papel que exercita as tabelas da aplicação.
set local role service_role;
insert into pcm.equipamento_categorias (id, nome, sigla, created_by, updated_by)
values ('00000000-0000-0000-0000-000000000156', '[TESTE] Categoria S156', 'T56', '00000000-0000-0000-0000-000000000162', '00000000-0000-0000-0000-000000000162');
select throws_ok(
  $$ insert into pcm.equipamento_categorias (id, nome, sigla, created_by, updated_by) values ('00000000-0000-0000-0000-000000000158', '[TESTE] Sigla inválida S156', 'LONGA', '00000000-0000-0000-0000-000000000162', '00000000-0000-0000-0000-000000000162') $$,
  '23514',
  null,
  'AC-2: check rejeita sigla fora de três caracteres'
);
select throws_ok(
  $$ insert into pcm.equipamento_categorias (id, nome, sigla, created_by, updated_by) values ('00000000-0000-0000-0000-000000000159', '[TESTE] Sigla duplicada S156', 'T56', '00000000-0000-0000-0000-000000000162', '00000000-0000-0000-0000-000000000162') $$,
  '23505',
  null,
  'AC-2: índice único rejeita sigla duplicada'
);

insert into pcm.equipamentos (id, nome, categoria_id, created_by, updated_by)
values ('00000000-0000-0000-0000-000000000157', '[TESTE] Componente S156', '00000000-0000-0000-0000-000000000156', '00000000-0000-0000-0000-000000000162', '00000000-0000-0000-0000-000000000162');
select is(
  (select categoria from pcm.equipamentos where id = '00000000-0000-0000-0000-000000000157'),
  '[TESTE] Categoria S156',
  'AC-4 passo 1: categoria_id preenche texto da categoria'
);

update pcm.equipamentos
set categoria_id = null
where id = '00000000-0000-0000-0000-000000000157';
select ok(
  (select categoria from pcm.equipamentos where id = '00000000-0000-0000-0000-000000000157') is null,
  'AC-4 passo 2: remover categoria_id limpa texto inalterado'
);

update pcm.equipamentos
set categoria = '[TESTE] Categoria S156'
where id = '00000000-0000-0000-0000-000000000157';
select is(
  (select categoria_id from pcm.equipamentos where id = '00000000-0000-0000-0000-000000000157'),
  '00000000-0000-0000-0000-000000000156'::uuid,
  'AC-4 passo 3: texto inbound resolve categoria_id'
);

insert into pcm.clientes (id, nome, created_by, updated_by)
values ('00000000-0000-0000-0000-000000000160', '[TESTE] Cliente S156', '00000000-0000-0000-0000-000000000162', '00000000-0000-0000-0000-000000000162');
insert into pcm.sistemas (id, cliente_id, nome, categoria_id, created_by, updated_by)
values ('00000000-0000-0000-0000-000000000161', '00000000-0000-0000-0000-000000000160', '[TESTE] Sistema S156', '00000000-0000-0000-0000-000000000156', '00000000-0000-0000-0000-000000000162', '00000000-0000-0000-0000-000000000162');
select is(
  (select categoria from pcm.sistemas where id = '00000000-0000-0000-0000-000000000161'),
  '[TESTE] Categoria S156',
  'AC-4: trigger de Sistema preenche texto da categoria'
);

select is(
  (select count(*)::int from pcm.auvo_sync_outbox where entity = 'equipamentos' and row_id = '00000000-0000-0000-0000-000000000157'),
  3,
  'atualizações normais enfileiram create e dois updates antes do backfill protegido'
);
set local app.auvo_sync_write = 'true';
update pcm.equipamentos
set categoria_id = '00000000-0000-0000-0000-000000000156'
where id = '00000000-0000-0000-0000-000000000157';
select is(
  (select count(*)::int from pcm.auvo_sync_outbox where entity = 'equipamentos' and row_id = '00000000-0000-0000-0000-000000000157'),
  3,
  'AC-5: backfill com app.auvo_sync_write não adiciona outbox'
);

reset role;
select * from finish();
rollback;
