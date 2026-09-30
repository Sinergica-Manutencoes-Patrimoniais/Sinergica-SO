-- pcm_sistema_itens_unico.test.sql — pgTAP (E01-S154, AC-3)
-- Componente pertence a no máximo 1 Sistema: índice único em pcm.sistema_itens (item_id).
-- Rodar com `supabase test db` (requer Docker/Supabase local — CI job `db-tests`).

begin;
select plan(3);

select has_index('pcm', 'sistema_itens', 'uq_sistema_itens_item_unico', 'índice único item_id existe');

set local role service_role;
insert into pcm.clientes (id, nome, created_by)
values ('54000000-0000-0000-0000-000000000001', 'Cliente S154', '00000000-0000-0000-0000-000000000762')
on conflict (id) do nothing;
insert into pcm.sistemas (id, cliente_id, nome, created_by)
values
  ('54000000-0000-0000-0000-0000000000s1', '54000000-0000-0000-0000-000000000001', 'Sistema A (fixture)', '00000000-0000-0000-0000-000000000762'),
  ('54000000-0000-0000-0000-0000000000s2', '54000000-0000-0000-0000-000000000001', 'Sistema B (fixture)', '00000000-0000-0000-0000-000000000762')
on conflict (id) do nothing;
insert into pcm.equipamentos (id, nome, client_id, created_by)
values ('54000000-0000-0000-0000-0000000000e1', 'Componente 1 (fixture)', '54000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000762')
on conflict (id) do nothing;

insert into pcm.sistema_itens (sistema_id, item_id, created_by)
values ('54000000-0000-0000-0000-0000000000s1', '54000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000762');

select lives_ok(
  $$ delete from pcm.sistema_itens where sistema_id = '54000000-0000-0000-0000-0000000000s1' and item_id = '54000000-0000-0000-0000-0000000000e1' $$,
  'remove do sistema A antes de tentar duplicar'
);
insert into pcm.sistema_itens (sistema_id, item_id, created_by)
values ('54000000-0000-0000-0000-0000000000s1', '54000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000762');

select throws_ok(
  $$ insert into pcm.sistema_itens (sistema_id, item_id, created_by) values ('54000000-0000-0000-0000-0000000000s2', '54000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000762') $$,
  '23505',
  null,
  'mesmo item em 2 sistemas é rejeitado pelo índice único'
);

select * from finish();
rollback;
