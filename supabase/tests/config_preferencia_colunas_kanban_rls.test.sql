-- config_preferencia_colunas_kanban_rls.test.sql — pgTAP (E01-S84 AC-1/AC-2)
-- `config.preferencia_colunas_kanban_os` é uma preferência estritamente por usuário — cada linha
-- só pode ser lida/escrita pelo próprio dono (`auth.uid() = user_id`), nunca por outro usuário
-- (nem entre colegas comuns, nem superadmin — preferência de UI não tem exceção administrativa).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-user-a-s84@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-user-b-s84@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000901","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';

-- 1) usuário A grava a própria preferência
insert into config.preferencia_colunas_kanban_os (user_id, colunas)
values ('00000000-0000-0000-0000-000000000901', '[{"id":"solicitacao","visivel":true},{"id":"corretiva","visivel":false}]'::jsonb);
select is(
  (select colunas ->> 0 from config.preferencia_colunas_kanban_os where user_id = '00000000-0000-0000-0000-000000000901') is not null,
  true,
  'usuario A grava a propria preferencia de colunas'
);

-- 2) usuário A NÃO consegue inserir preferência em nome de outro usuário (with check bloqueia)
select throws_ok(
  $$ insert into config.preferencia_colunas_kanban_os (user_id, colunas) values ('00000000-0000-0000-0000-000000000902', '[]'::jsonb) $$,
  '42501',
  null,
  'usuario A NAO grava preferencia em nome do usuario B (with check user_id = auth.uid())'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000902","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';

-- 3) usuário B NÃO lê a preferência do usuário A (RLS filtra a linha, select devolve vazio)
select is(
  (select count(*) from config.preferencia_colunas_kanban_os where user_id = '00000000-0000-0000-0000-000000000901'),
  0::bigint,
  'usuario B NAO le a preferencia do usuario A (RLS filtra a linha)'
);

-- 4) usuário B grava a própria — não colide com a do A (chaves primárias distintas)
insert into config.preferencia_colunas_kanban_os (user_id, colunas)
values ('00000000-0000-0000-0000-000000000902', '[{"id":"planejamento","visivel":true}]'::jsonb);
select is(
  (select count(*) from config.preferencia_colunas_kanban_os where user_id = '00000000-0000-0000-0000-000000000902'),
  1::bigint,
  'usuario B grava a propria preferencia, independente da do usuario A'
);

reset role;
-- 5) service_role (upsert do adapter) enxerga as duas linhas — sanity check final, sem RLS
select is(
  (select count(*) from config.preferencia_colunas_kanban_os where user_id in ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000902')),
  2::bigint,
  'as 2 preferencias (A e B) existem, cada uma isolada por RLS'
);

delete from config.preferencia_colunas_kanban_os where user_id in ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000902');

select * from finish();
rollback;
