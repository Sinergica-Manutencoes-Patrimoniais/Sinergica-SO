-- pcm_equipment_mirror.test.sql — pgTAP (E01-S04, AC-1..AC-5)
-- Espelho automático pmoc_equipment -> pcm_equipment (trigger fn_pmoc_equipment_espelha_pcm) +
-- RLS por papel (por efeito) + confirma que a aplicação não escreve direto no espelho (AC-4).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's04-leitura@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's04-escrita@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's04-sem-modulo@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role service_role;
insert into pcm.clientes (id, nome, created_by)
values ('04000000-0000-0000-0000-000000000001', 'Cliente S04', '00000000-0000-0000-0000-000000000402')
on conflict (id) do nothing;
insert into pcm.pmoc_properties (id, client_id, name, created_by)
values ('04000000-0000-0000-0000-000000000010', '04000000-0000-0000-0000-000000000001', 'Imóvel S04', '00000000-0000-0000-0000-000000000402')
on conflict (id) do nothing;
reset role;

-- ── AC-2: insert em pmoc_equipment espelha em pcm_equipment ─────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000402","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';

select lives_ok(
  $$ insert into pcm.pmoc_equipment (id, property_id, tag, brand, model, created_by) values ('04000000-0000-0000-0000-0000000000e1', '04000000-0000-0000-0000-000000000010', 'AC-01', 'LG', 'Dual Inverter', '00000000-0000-0000-0000-000000000402') $$,
  'pcm escrita insere equipamento PMOC (AC-2)'
);
select is(
  (select discipline from pcm.pcm_equipment where pmoc_equipment_id = '04000000-0000-0000-0000-0000000000e1'),
  'climatizacao',
  'espelho grava discipline=climatizacao (AC-2)'
);
select is(
  (select name from pcm.pcm_equipment where pmoc_equipment_id = '04000000-0000-0000-0000-0000000000e1'),
  'LG Dual Inverter',
  'espelho sintetiza name a partir de brand+model (AC-2)'
);

-- equipamento sem brand/model — name cai pro tag (borda)
select lives_ok(
  $$ insert into pcm.pmoc_equipment (id, property_id, tag, created_by) values ('04000000-0000-0000-0000-0000000000e2', '04000000-0000-0000-0000-000000000010', 'AC-02', '00000000-0000-0000-0000-000000000402') $$,
  'pcm escrita insere equipamento PMOC sem brand/model'
);
select is(
  (select name from pcm.pcm_equipment where pmoc_equipment_id = '04000000-0000-0000-0000-0000000000e2'),
  'AC-02',
  'espelho cai pro tag quando brand/model ausentes (borda)'
);

-- ── AC-3: update em pmoc_equipment propaga sem duplicar linha ───────────────
select lives_ok(
  $$ update pcm.pmoc_equipment set brand = 'Daikin', updated_by = '00000000-0000-0000-0000-000000000402' where id = '04000000-0000-0000-0000-0000000000e1' $$,
  'pcm escrita edita equipamento PMOC'
);
select is(
  (select brand from pcm.pcm_equipment where pmoc_equipment_id = '04000000-0000-0000-0000-0000000000e1'),
  'Daikin',
  'espelho acompanha update (AC-3)'
);
select is(
  (select count(*)::int from pcm.pcm_equipment where pmoc_equipment_id = '04000000-0000-0000-0000-0000000000e1'),
  1,
  'update nao duplica linha no espelho (AC-3, upsert por pmoc_equipment_id)'
);

-- ── AC-4: aplicação não escreve direto no espelho ────────────────────────────
select throws_ok(
  $$ insert into pcm.pcm_equipment (property_id, tag, created_by) values ('04000000-0000-0000-0000-000000000010', 'Fantasma', '00000000-0000-0000-0000-000000000402') $$,
  '42501',
  null,
  'pcm escrita NAO insere direto em pcm_equipment (AC-4, so o trigger escreve)'
);

-- ── AC-5: RLS select por papel ────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000401","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select is(
  (select count(*)::int from pcm.pcm_equipment where property_id = '04000000-0000-0000-0000-000000000010'),
  2,
  'pcm leitura ve os 2 equipamentos espelhados (AC-5)'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000403","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*)::int from pcm.pcm_equipment where property_id = '04000000-0000-0000-0000-000000000010'),
  0,
  'usuario sem modulo pcm nao ve nenhum equipamento (AC-5)'
);

select * from finish();
rollback;
