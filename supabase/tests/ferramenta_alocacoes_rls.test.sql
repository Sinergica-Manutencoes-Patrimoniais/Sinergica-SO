-- ferramenta_alocacoes_rls.test.sql — pgTAP (E01-S30, AC-5/AC-6/AC-7)
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aloc-leitura-s30@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aloc-escrita-s30@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role service_role;
insert into pcm.ferramentas (id, nome, quantidade_total, quantidade_minima, auvo_id)
values ('30000000-0000-0000-0000-000000000002', 'Ferramenta Alocável S30', 5, 1, 300002)
on conflict (id) do nothing;
insert into pcm.funcionarios (id, nome, auvo_user_id, auvo_id)
values ('30000000-0000-0000-0000-000000000003', 'Técnico S30', 300003, 300003)
on conflict (auvo_user_id) do nothing;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000303","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok(
  $$ insert into pcm.ferramenta_alocacoes (ferramenta_id, auvo_user_id, quantidade, created_by) values ('30000000-0000-0000-0000-000000000002', 300003, 1, '00000000-0000-0000-0000-000000000303') $$,
  '42501',
  null,
  'pcm leitura NAO insere alocacoes'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000304","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.ferramenta_alocacoes (ferramenta_id, auvo_user_id, funcionario_id, quantidade, created_by, updated_by) values ('30000000-0000-0000-0000-000000000002', 300003, '30000000-0000-0000-0000-000000000003', 2, '00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000304') $$,
  'pcm escrita insere alocacoes'
);
select lives_ok(
  $$ update pcm.ferramenta_alocacoes set quantidade = 3, updated_by = '00000000-0000-0000-0000-000000000304' where ferramenta_id = '30000000-0000-0000-0000-000000000002' and auvo_user_id = 300003 $$,
  'pcm escrita edita alocacoes'
);
reset role;

set local role service_role;
select is(
  pcm.fn_reconcile_ferramenta_alocacoes(
    '30000000-0000-0000-0000-000000000002',
    '[{"userId":300003,"amount":4}]'::jsonb
  ),
  1,
  'rpc reconcilia employeesStock'
);
select is(
  (select quantidade from pcm.ferramenta_alocacoes where ferramenta_id = '30000000-0000-0000-0000-000000000002' and auvo_user_id = 300003),
  4,
  'employeesStock atualiza quantidade local'
);
reset role;

select * from finish();
rollback;
