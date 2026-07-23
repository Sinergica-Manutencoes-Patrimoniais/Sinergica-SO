-- pcm_localizacao_auvo_hierarquica.test.sql — pgTAP (E01-S85 AC-1/AC-2/AC-3/AC-4)
-- Prova: concatenação hierárquica correta, recálculo automático ao mover um ativo (AC-3), fan-out
-- em rename de Área/Local propaga pros ativos afetados (AC-2), Sistema usa só a Área (AC-4), e a
-- preferência de separador/ordem é superadmin-only (AC-1).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-escrita-s85@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'colaborador-s85@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, created_by)
values ('00000000-0000-0000-0000-000000000ac1', '[TESTE] Cliente S85', '00000000-0000-0000-0000-000000000a01')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000a01","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';

insert into pcm.areas (id, cliente_id, nome, created_by)
values ('00000000-0000-0000-0000-000000000ac2', '00000000-0000-0000-0000-000000000ac1', 'Torre A', '00000000-0000-0000-0000-000000000a01');

insert into pcm.locais (id, area_id, parent_id, nome, created_by)
values
  ('00000000-0000-0000-0000-000000000ac3', '00000000-0000-0000-0000-000000000ac2', null, '1º andar', '00000000-0000-0000-0000-000000000a01'),
  ('00000000-0000-0000-0000-000000000ac4', '00000000-0000-0000-0000-000000000ac2', '00000000-0000-0000-0000-000000000ac3', 'Sala 001', '00000000-0000-0000-0000-000000000a01');

-- 1) AC-1: função monta a cadeia completa (Área · Local · Sublocal) com o separador padrão
select is(
  pcm.fn_montar_localizacao_hierarquica('00000000-0000-0000-0000-000000000ac4'),
  'Torre A · 1º andar · Sala 001',
  'AC-1: concatena Área+Local+Sublocal com separador padrao'
);

-- 2) sem sublocal — só Área + Local
select is(
  pcm.fn_montar_localizacao_hierarquica('00000000-0000-0000-0000-000000000ac3'),
  'Torre A · 1º andar',
  'sem sublocal, concatena so Area+Local'
);

-- 3) AC-3: criar um equipamento já com local_id calcula auvo_localizacao automaticamente
insert into pcm.equipamentos (id, client_id, nome, local_id, created_by)
values ('00000000-0000-0000-0000-000000000ac5', '00000000-0000-0000-0000-000000000ac1', '[TESTE] Bomba', '00000000-0000-0000-0000-000000000ac4', '00000000-0000-0000-0000-000000000a01');
select is(
  (select auvo_localizacao from pcm.equipamentos where id = '00000000-0000-0000-0000-000000000ac5'),
  'Torre A · 1º andar · Sala 001',
  'AC-3: trigger recalcula auvo_localizacao no INSERT com local_id'
);

-- 4) AC-3: mover o equipamento (update de local_id) recalcula pro novo local
select is(
  (select auvo_localizacao from pcm.equipamentos where id = '00000000-0000-0000-0000-000000000ac5' and local_id = '00000000-0000-0000-0000-000000000ac4'),
  'Torre A · 1º andar · Sala 001',
  'estado antes de mover'
);
update pcm.equipamentos set local_id = '00000000-0000-0000-0000-000000000ac3' where id = '00000000-0000-0000-0000-000000000ac5';
select is(
  (select auvo_localizacao from pcm.equipamentos where id = '00000000-0000-0000-0000-000000000ac5'),
  'Torre A · 1º andar',
  'AC-3: mover o ativo (update de local_id) recalcula a localizacao'
);

-- 5) AC-2: renomear o Local propaga pro equipamento afetado
update pcm.locais set nome = '1º andar (reformado)' where id = '00000000-0000-0000-0000-000000000ac3';
select is(
  (select auvo_localizacao from pcm.equipamentos where id = '00000000-0000-0000-0000-000000000ac5'),
  'Torre A · 1º andar (reformado)',
  'AC-2: rename de Local propaga (fan-out) pro equipamento afetado'
);

-- 6) AC-2: renomear a Área também propaga
update pcm.areas set nome = 'Torre A (renomeada)' where id = '00000000-0000-0000-0000-000000000ac2';
select is(
  (select auvo_localizacao from pcm.equipamentos where id = '00000000-0000-0000-0000-000000000ac5'),
  'Torre A (renomeada) · 1º andar (reformado)',
  'AC-2: rename de Area propaga (fan-out) pro equipamento afetado'
);

-- 7) AC-2: o rename também reenfileira no outbox genérico (via trigger de enqueue já existente)
reset role;
set local role service_role;
select ok(
  (select count(*) > 0 from pcm.auvo_sync_outbox where entity = 'equipamentos' and row_id = '00000000-0000-0000-0000-000000000ac5' and op = 'update'),
  'AC-2: rename reenfileira o equipamento afetado no outbox (op=update)'
);
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000a01","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';

-- 8) AC-4: Sistema usa só a Área (sem local_id no schema)
insert into pcm.sistemas (id, cliente_id, area_id, nome, created_by)
values ('00000000-0000-0000-0000-000000000ac6', '00000000-0000-0000-0000-000000000ac1', '00000000-0000-0000-0000-000000000ac2', '[TESTE] Sistema Hidrante', '00000000-0000-0000-0000-000000000a01');
select is(
  (select auvo_localizacao from pcm.sistemas where id = '00000000-0000-0000-0000-000000000ac6'),
  'Torre A (renomeada)',
  'AC-4: Sistema calcula auvo_localizacao so com o nome da Area'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000a02","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';

-- 9) AC-1: usuário comum NAO altera o separador/ordem (escrita superadmin-only)
update config.preferencia_localizacao_auvo set separador = ' / ' where id = 1;
select is(
  (select separador from config.preferencia_localizacao_auvo where id = 1),
  ' · ',
  'AC-1: usuario comum NAO altera separador/ordem (RLS filtra zero linhas)'
);

reset role;
select * from finish();
rollback;
