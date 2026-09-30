-- pcm_posicao_flexivel.test.sql — pgTAP (E01-S155)
-- Posição flexível de Componente/Sistema: Local define a Área, Área define o cliente quando
-- ausente, cliente divergente é rejeitado, localização recalculada e propagada em rename.
-- Todos os cenários abaixo foram smoke-testados contra produção (begin/rollback, sem Docker
-- disponível nesta sessão) antes de aplicar 0217/0218 — ver docs/STATE.md 2026-09-30.
-- Rodar com `supabase test db` (requer Docker/Supabase local — CI job `db-tests`).

begin;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000155', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'posicao-s155@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role service_role;
insert into pcm.clientes (id, nome, created_by) values
  ('15500000-0000-0000-0000-000000000001', 'Cliente S155 X', '00000000-0000-0000-0000-000000000155'),
  ('15500000-0000-0000-0000-000000000002', 'Cliente S155 Y', '00000000-0000-0000-0000-000000000155');
insert into pcm.areas (id, cliente_id, nome, created_by) values
  ('15500000-0000-0000-0000-0000000000a1', '15500000-0000-0000-0000-000000000001', 'Área X1', '00000000-0000-0000-0000-000000000155'),
  ('15500000-0000-0000-0000-0000000000a2', '15500000-0000-0000-0000-000000000002', 'Área Y1', '00000000-0000-0000-0000-000000000155');
insert into pcm.locais (id, area_id, nome, created_by) values
  ('15500000-0000-0000-0000-0000000000d1', '15500000-0000-0000-0000-0000000000a1', 'Local X1', '00000000-0000-0000-0000-000000000155');

-- AC-1: Componente só na Área
insert into pcm.equipamentos (id, nome, client_id, area_id, created_by)
values ('15500000-0000-0000-0000-0000000000e1', 'Comp AC1', '15500000-0000-0000-0000-000000000001', '15500000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000155');
select is(
  (select auvo_localizacao from pcm.equipamentos where id = '15500000-0000-0000-0000-0000000000e1'),
  'Área X1',
  'AC-1: Componente só na Área grava auvo_localizacao = nome da Área'
);

-- AC-2: Local define a Área (mandando area_id null)
insert into pcm.equipamentos (id, nome, client_id, local_id, area_id, created_by)
values ('15500000-0000-0000-0000-0000000000e2', 'Comp AC2', '15500000-0000-0000-0000-000000000001', '15500000-0000-0000-0000-0000000000d1', null, '00000000-0000-0000-0000-000000000155');
select is(
  (select area_id from pcm.equipamentos where id = '15500000-0000-0000-0000-0000000000e2'),
  '15500000-0000-0000-0000-0000000000a1'::uuid,
  'AC-2: Local define a área do Componente'
);
select is(
  (select auvo_localizacao from pcm.equipamentos where id = '15500000-0000-0000-0000-0000000000e2'),
  'Área X1 · Local X1',
  'AC-2: auvo_localizacao usa o caminho hierárquico do Local'
);

-- AC-3: Sistema num Local
insert into pcm.sistemas (id, cliente_id, nome, local_id, created_by)
values ('15500000-0000-0000-0000-0000000000c1', '15500000-0000-0000-0000-000000000001', 'Sistema AC3', '15500000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000155');
select is(
  (select area_id from pcm.sistemas where id = '15500000-0000-0000-0000-0000000000c1'),
  '15500000-0000-0000-0000-0000000000a1'::uuid,
  'AC-3: Sistema com Local deriva a área'
);

-- AC-4: só no cliente
insert into pcm.equipamentos (id, nome, client_id, created_by)
values ('15500000-0000-0000-0000-0000000000e4', 'Comp AC4', '15500000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000155');
select is(
  (select auvo_localizacao from pcm.equipamentos where id = '15500000-0000-0000-0000-0000000000e4'),
  null,
  'AC-4: sem Área e sem Local, auvo_localizacao é null'
);

-- AC-6: cliente null preenchido a partir da Área
insert into pcm.equipamentos (id, nome, client_id, area_id, created_by)
values ('15500000-0000-0000-0000-0000000000e6', 'Comp AC6', null, '15500000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000155');
select is(
  (select client_id from pcm.equipamentos where id = '15500000-0000-0000-0000-0000000000e6'),
  '15500000-0000-0000-0000-000000000001'::uuid,
  'AC-6: cliente null é preenchido a partir da Área'
);

-- AC-6: cliente divergente rejeitado
select throws_ok(
  $$ insert into pcm.equipamentos (id, nome, client_id, area_id, created_by) values ('15500000-0000-0000-0000-0000000000e7', 'Comp AC6 divergente', '15500000-0000-0000-0000-000000000002', '15500000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000155') $$,
  '23514',
  null,
  'AC-6: cliente divergente da Área é rejeitado'
);

-- AC-7: rename de Área propaga pro Componente só-com-área e pro Sistema-com-local
update pcm.areas set nome = 'Área X1 renomeada' where id = '15500000-0000-0000-0000-0000000000a1';
select is(
  (select auvo_localizacao from pcm.equipamentos where id = '15500000-0000-0000-0000-0000000000e1'),
  'Área X1 renomeada',
  'AC-7: rename de Área propaga pro Componente só-com-área'
);
select is(
  (select auvo_localizacao from pcm.sistemas where id = '15500000-0000-0000-0000-0000000000c1'),
  'Área X1 renomeada · Local X1',
  'AC-7: rename de Área propaga pro Sistema com Local (via área efetiva)'
);

-- rename de Local propaga pro Sistema e pro Componente que estão nele
update pcm.locais set nome = 'Local X1 renomeado' where id = '15500000-0000-0000-0000-0000000000d1';
select is(
  (select auvo_localizacao from pcm.sistemas where id = '15500000-0000-0000-0000-0000000000c1'),
  'Área X1 renomeada · Local X1 renomeado',
  'AC-7: rename de Local propaga pro Sistema'
);
select is(
  (select auvo_localizacao from pcm.equipamentos where id = '15500000-0000-0000-0000-0000000000e2'),
  'Área X1 renomeada · Local X1 renomeado',
  'AC-7: rename de Local propaga pro Componente'
);

select * from finish();
rollback;
