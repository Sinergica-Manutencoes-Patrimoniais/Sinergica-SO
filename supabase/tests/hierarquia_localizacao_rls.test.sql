-- hierarquia_localizacao_rls.test.sql — pgTAP (E01-S76, AC-3/AC-7/AC-8/AC-9)
-- RLS por papel (por efeito) das 4 tabelas novas (pcm.areas, pcm.locais, pcm.sistemas,
-- pcm.sistema_itens) + trigger anti-ciclo/consistência de área (fn_locais_valida_hierarquia) +
-- outbox Auvo de pcm.sistemas (dry-run, writeEnabled:false não é testado aqui — isso é
-- comportamento do drain/edge function, fora do escopo do banco).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(17);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000761', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hier-leitura-s76@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000762', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hier-escrita-s76@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role service_role;
insert into pcm.clientes (id, nome, created_by)
values ('76000000-0000-0000-0000-000000000001', 'Cliente S76', '00000000-0000-0000-0000-000000000762')
on conflict (id) do nothing;
-- Segunda Área (mesmo cliente) — usada só pra provar INV-2 (local pai de outra Área é rejeitado).
insert into pcm.areas (id, cliente_id, nome, created_by)
values ('76000000-0000-0000-0000-0000000000a2', '76000000-0000-0000-0000-000000000001', 'Torre B (fixture)', '00000000-0000-0000-0000-000000000762')
on conflict (id) do nothing;
insert into pcm.locais (id, area_id, nome, created_by)
values ('76000000-0000-0000-0000-0000000000b2', '76000000-0000-0000-0000-0000000000a2', 'Local Torre B (fixture)', '00000000-0000-0000-0000-000000000762')
on conflict (id) do nothing;
reset role;

-- ── pcm.areas — AC-1/AC-9 ─────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000761","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok(
  $$ insert into pcm.areas (cliente_id, nome, created_by) values ('76000000-0000-0000-0000-000000000001', 'Torre A negada', '00000000-0000-0000-0000-000000000761') $$,
  '42501',
  null,
  'pcm leitura NAO insere areas'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000762","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.areas (id, cliente_id, nome, created_by, updated_by) values ('76000000-0000-0000-0000-00000000a001', '76000000-0000-0000-0000-000000000001', 'Torre A', '00000000-0000-0000-0000-000000000762', '00000000-0000-0000-0000-000000000762') $$,
  'pcm escrita insere areas (AC-1)'
);
select lives_ok(
  $$ update pcm.areas set nome = 'Torre A editada', updated_by = '00000000-0000-0000-0000-000000000762' where id = '76000000-0000-0000-0000-00000000a001' $$,
  'pcm escrita edita areas'
);

-- ── pcm.locais (árvore) — AC-2/AC-3 ──────────────────────────────────────
select lives_ok(
  $$ insert into pcm.locais (id, area_id, nome, tipo, created_by, updated_by) values ('76000000-0000-0000-0000-00000000b001', '76000000-0000-0000-0000-00000000a001', '3º andar', 'andar', '00000000-0000-0000-0000-000000000762', '00000000-0000-0000-0000-000000000762') $$,
  'pcm escrita insere local raiz (AC-2)'
);
select lives_ok(
  $$ insert into pcm.locais (id, area_id, parent_id, nome, tipo, created_by, updated_by) values ('76000000-0000-0000-0000-00000000b002', '76000000-0000-0000-0000-00000000a001', '76000000-0000-0000-0000-00000000b001', 'Sala 302', 'sala', '00000000-0000-0000-0000-000000000762', '00000000-0000-0000-0000-000000000762') $$,
  'pcm escrita insere sub-local com parent_id (AC-2)'
);
select throws_ok(
  $$ update pcm.locais set parent_id = '76000000-0000-0000-0000-00000000b002' where id = '76000000-0000-0000-0000-00000000b001' $$,
  'P0001',
  'Ciclo de Local detectado',
  'trigger rejeita ciclo de Local (AC-3, INV-1)'
);
select throws_ok(
  $$ update pcm.locais set parent_id = '76000000-0000-0000-0000-0000000000b2' where id = '76000000-0000-0000-0000-00000000b002' $$,
  'P0001',
  'Local pai deve pertencer à mesma Área',
  'trigger rejeita parent_id de outra Área (AC-3, INV-2)'
);

-- ── pcm.sistemas — AC-7/AC-9 ──────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000761","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok(
  $$ insert into pcm.sistemas (cliente_id, nome, created_by) values ('76000000-0000-0000-0000-000000000001', 'Sistema negado', '00000000-0000-0000-0000-000000000761') $$,
  '42501',
  null,
  'pcm leitura NAO insere sistemas'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000762","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.sistemas (id, cliente_id, nome, created_by, updated_by) values ('76000000-0000-0000-0000-00000000c001', '76000000-0000-0000-0000-000000000001', 'Sistema de Hidrante Torre A', '00000000-0000-0000-0000-000000000762', '00000000-0000-0000-0000-000000000762') $$,
  'pcm escrita insere sistemas (AC-7)'
);
select lives_ok(
  $$ update pcm.sistemas set descricao = 'Editado', updated_by = '00000000-0000-0000-0000-000000000762' where id = '76000000-0000-0000-0000-00000000c001' $$,
  'pcm escrita edita sistemas'
);
select lives_ok(
  $$ update pcm.sistemas set ativo = false, deleted_at = now(), updated_by = '00000000-0000-0000-0000-000000000762' where id = '76000000-0000-0000-0000-00000000c001' $$,
  'pcm escrita desativa sistemas'
);
reset role;

-- AC-8: create/update/delete de pcm.sistemas enfileiram no outbox (drain/writeEnabled é
-- responsabilidade da edge function, testada isoladamente — aqui só o lado do banco).
set local role service_role;
select is(
  (select count(*)::int from pcm.auvo_sync_outbox where entity = 'sistemas' and row_id = '76000000-0000-0000-0000-00000000c001'),
  3,
  'trigger sistemas enfileira create/update/delete no outbox (AC-8)'
);
select bag_eq(
  $$ select op from pcm.auvo_sync_outbox where entity = 'sistemas' and row_id = '76000000-0000-0000-0000-00000000c001' order by op $$,
  $$ values ('create'::text), ('delete'::text), ('update'::text) $$,
  'outbox de sistemas registra as tres operacoes esperadas'
);

-- Fixture de Item (pcm.equipamentos) pra testar pcm.sistema_itens.
insert into pcm.equipamentos (id, nome, client_id, tipo, created_by, updated_by)
values ('76000000-0000-0000-0000-00000000d001', 'Hidrante 1', '76000000-0000-0000-0000-000000000001', 'equipamento', '00000000-0000-0000-0000-000000000762', '00000000-0000-0000-0000-000000000762')
on conflict (id) do nothing;
reset role;

-- ── pcm.sistema_itens (N:N) — AC-7/AC-9 ──────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000761","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok(
  $$ insert into pcm.sistema_itens (sistema_id, item_id, created_by) values ('76000000-0000-0000-0000-00000000c001', '76000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000761') $$,
  '42501',
  null,
  'pcm leitura NAO insere sistema_itens'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000762","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.sistema_itens (id, sistema_id, item_id, created_by) values ('76000000-0000-0000-0000-00000000e001', '76000000-0000-0000-0000-00000000c001', '76000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000762') $$,
  'pcm escrita adiciona item ao sistema (AC-7)'
);
select throws_ok(
  $$ insert into pcm.sistema_itens (sistema_id, item_id, created_by) values ('76000000-0000-0000-0000-00000000c001', '76000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000762') $$,
  '23505',
  null,
  'unique(sistema_id,item_id) impede item duplicado no mesmo sistema (INV-6)'
);
select lives_ok(
  $$ delete from pcm.sistema_itens where id = '76000000-0000-0000-0000-00000000e001' $$,
  'pcm escrita remove item do sistema'
);
reset role;

select * from finish();
rollback;
