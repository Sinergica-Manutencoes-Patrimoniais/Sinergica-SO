-- ferramenta_reservas_rls.test.sql — pgTAP (E01-S64, AC-1 a AC-4)
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ferr-res-leitura-s64@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ferr-res-escrita-s64@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000502","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';

insert into pcm.ferramentas (id, nome, quantidade_total, quantidade_minima, created_by, updated_by)
values ('50000000-0000-0000-0000-000000000001', 'Martelete S64', 1, 0, '00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000502');
insert into pcm.ferramenta_unidades (id, ferramenta_id, created_by, updated_by)
values ('50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000502');
insert into pcm.funcionarios (id, nome, created_by, updated_by)
values ('50000000-0000-0000-0000-000000000003', 'Técnico S64', '00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000502');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000501","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok(
  $$ insert into pcm.ferramenta_reservas (ferramenta_id, unidade_id, funcionario_id, data_inicio, data_fim, created_by) values ('50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', '2026-08-01', '2026-08-01', '00000000-0000-0000-0000-000000000501') $$,
  '42501',
  null,
  'pcm leitura NAO cria reserva de ferramenta'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000502","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.ferramenta_reservas (id, ferramenta_id, unidade_id, funcionario_id, data_inicio, data_fim, created_by) values ('50000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', '2026-08-01', '2026-08-03', '00000000-0000-0000-0000-000000000502') $$,
  'pcm escrita cria reserva de unidade especifica'
);
select is(
  (select status from pcm.ferramenta_reservas where id = '50000000-0000-0000-0000-000000000004'),
  'pendente',
  'reserva nasce pendente'
);

-- AC-2: conflito de intervalo na mesma unidade é rejeitado.
select throws_ok(
  $$ insert into pcm.ferramenta_reservas (ferramenta_id, unidade_id, funcionario_id, data_inicio, data_fim, created_by) values ('50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', '2026-08-02', '2026-08-02', '00000000-0000-0000-0000-000000000502') $$,
  'P0001',
  null,
  'reserva sobreposta na mesma unidade eh rejeitada (conflito)'
);

-- Sem sobreposição — passa normalmente.
select lives_ok(
  $$ insert into pcm.ferramenta_reservas (id, ferramenta_id, unidade_id, funcionario_id, data_inicio, data_fim, created_by) values ('50000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', '2026-08-10', '2026-08-10', '00000000-0000-0000-0000-000000000502') $$,
  'reserva sem sobreposicao de intervalo eh aceita'
);

-- AC-4: cancelar (UPDATE, ao contrário de movimentações, reserva pode mudar de status).
select lives_ok(
  $$ update pcm.ferramenta_reservas set status = 'cancelada', updated_by = '00000000-0000-0000-0000-000000000502' where id = '50000000-0000-0000-0000-000000000005' $$,
  'pcm escrita cancela reserva pendente'
);

-- AC-3: efetivar troca status e re-atesta unidade (aqui só a coluna; a atribuição real é
-- orquestrada pelo caso de uso no app, não pelo banco).
select lives_ok(
  $$ update pcm.ferramenta_reservas set status = 'efetivada', updated_by = '00000000-0000-0000-0000-000000000502' where id = '50000000-0000-0000-0000-000000000004' $$,
  'pcm escrita efetiva reserva pendente'
);

reset role;
select * from finish();
rollback;
