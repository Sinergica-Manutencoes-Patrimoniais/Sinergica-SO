-- e00-s05_rbac.test.sql — pgTAP: prova RBAC + permissões por módulo (E00-S09).
-- Rodar com: supabase test db (requer `supabase start` local — ver db/rls-test.md)

begin;
select plan(28);

-- ─────────────────────────── SEED (como superuser) ─────────────────────────

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'superadmin@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'supervisor@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'colaborador-leitura@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'colaborador-escrita@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sindico@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inativo@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

select config.provisionar_usuario('00000000-0000-0000-0000-000000000001', 'superadmin', 'Superadmin Teste');
select config.provisionar_usuario('00000000-0000-0000-0000-000000000002', 'supervisor', 'Supervisor Teste');
select config.provisionar_usuario('00000000-0000-0000-0000-000000000003', 'colaborador', 'Colaborador Leitura');
select config.provisionar_usuario('00000000-0000-0000-0000-000000000004', 'colaborador', 'Colaborador Escrita');
select config.provisionar_usuario('00000000-0000-0000-0000-000000000005', 'cliente-sindico', 'Sindico Teste');
select config.provisionar_usuario('00000000-0000-0000-0000-000000000006', 'colaborador', 'Inativo Teste');

insert into config.grupos (id, nome) values
  ('80000000-0000-0000-0000-000000000001', 'PCM leitura'),
  ('80000000-0000-0000-0000-000000000002', 'Atendimento inativo');

insert into config.grupo_modulos (grupo_id, modulo, nivel) values
  ('80000000-0000-0000-0000-000000000001', 'pcm', 'leitura'),
  ('80000000-0000-0000-0000-000000000001', 'atendimento', 'leitura'),
  ('80000000-0000-0000-0000-000000000002', 'comercial', 'escrita');

update config.grupos set ativo = false where id = '80000000-0000-0000-0000-000000000002';
update config.usuarios set grupo_id = '80000000-0000-0000-0000-000000000001' where user_id = '00000000-0000-0000-0000-000000000003';
update config.usuarios set ativo = false where user_id = '00000000-0000-0000-0000-000000000006';
insert into config.usuario_modulos (user_id, modulo, nivel) values
  ('00000000-0000-0000-0000-000000000004', 'pcm', 'escrita'),
  ('00000000-0000-0000-0000-000000000004', 'comercial', 'leitura'),
  ('00000000-0000-0000-0000-000000000006', 'pcm', 'escrita');

insert into pcm.clientes (id, nome, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'Condomínio Teste', '00000000-0000-0000-0000-000000000001');

insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, created_by) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'CH-TEST-001', 'OS de teste', 'corretiva', '00000000-0000-0000-0000-000000000001');

insert into atendimento.config_ze (id, client_id, created_by) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');

insert into atendimento.wa_messages (id, instance_id, remote_jid, message_id) values
  ('40000000-0000-0000-0000-000000000001', 'inst-teste', 'jid-teste', 'msg-teste-001');

insert into atendimento.wa_queue (id, queue_key, wait_until) values
  ('50000000-0000-0000-0000-000000000001', 'fila-teste', now());

insert into comercial.leads (id, nome, created_by) values
  ('60000000-0000-0000-0000-000000000001', 'Lead Teste', '00000000-0000-0000-0000-000000000001');

insert into config.feature_flags (id, chave) values
  ('70000000-0000-0000-0000-000000000001', 'flag_teste');

reset role;

-- ─────────────────────────── CONFIG CRUD / XOR ─────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","user_role":"supervisor"}';
select lives_ok(
  $$ insert into config.grupos (nome, created_by) values ('Grupo criado por supervisor', '00000000-0000-0000-0000-000000000002') $$,
  'supervisor cria grupo'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","user_role":"colaborador","user_modulos":{"pcm":"leitura","atendimento":"leitura"}}';
select throws_ok(
  $$ insert into config.grupos (nome, created_by) values ('Grupo proibido', '00000000-0000-0000-0000-000000000003') $$,
  '42501', null, 'colaborador NAO cria grupo'
);

reset role;

select throws_ok(
  $$ insert into config.usuario_modulos (user_id, modulo, nivel) values ('00000000-0000-0000-0000-000000000003', 'comercial', 'leitura') $$,
  '23514', null, 'usuario com grupo NAO recebe permissao individual'
);

select throws_ok(
  $$ update config.usuarios set grupo_id = '80000000-0000-0000-0000-000000000001' where user_id = '00000000-0000-0000-0000-000000000004' $$,
  '23514', null, 'usuario com permissao individual NAO recebe grupo direto'
);

select lives_ok(
  $$ select config.definir_permissao_usuario('00000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000001', null) $$,
  'definir_permissao_usuario troca individual para grupo atomicamente'
);

select is(
  (select count(*) from config.usuario_modulos where user_id = '00000000-0000-0000-0000-000000000004')::int,
  0,
  'troca para grupo remove permissoes individuais'
);

select lives_ok(
  $$ select config.definir_permissao_usuario('00000000-0000-0000-0000-000000000004', null, '{"pcm":"escrita","comercial":"leitura"}'::jsonb) $$,
  'definir_permissao_usuario troca grupo para individual atomicamente'
);

-- ─────────────────────────── RESOLVER / HOOK / VIEW ────────────────────────

select is(
  (select jsonb_object_agg(modulo, nivel) from config.resolver_permissoes_modulo('00000000-0000-0000-0000-000000000003')),
  '{"pcm":"leitura","atendimento":"leitura"}'::jsonb,
  'resolver retorna permissoes do grupo ativo'
);

select is(
  (select jsonb_object_agg(modulo, nivel) from config.resolver_permissoes_modulo('00000000-0000-0000-0000-000000000004')),
  '{"pcm":"escrita","comercial":"leitura"}'::jsonb,
  'resolver retorna permissoes individuais'
);

update config.usuarios set grupo_id = '80000000-0000-0000-0000-000000000002' where user_id = '00000000-0000-0000-0000-000000000003';
select is(
  (select count(*) from config.resolver_permissoes_modulo('00000000-0000-0000-0000-000000000003'))::int,
  0,
  'grupo inativo resolve fail-closed'
);
update config.usuarios set grupo_id = '80000000-0000-0000-0000-000000000001' where user_id = '00000000-0000-0000-0000-000000000003';

select is(
  config.custom_access_token_hook('{"user_id":"00000000-0000-0000-0000-000000000004","claims":{}}'::jsonb) #> '{claims,user_modulos}',
  '{"pcm":"escrita","comercial":"leitura"}'::jsonb,
  'hook emite user_modulos fiel ao resolver'
);

select is(
  config.custom_access_token_hook('{"user_id":"00000000-0000-0000-0000-000000000006","claims":{}}'::jsonb) #> '{claims,user_modulos}',
  '{}'::jsonb,
  'usuario inativo recebe user_modulos vazio'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","user_role":"colaborador","user_modulos":{"pcm":"escrita","comercial":"leitura"}}';
select is((select count(*) from config.minhas_permissoes)::int, 2, 'minhas_permissoes retorna permissoes do proprio usuario');
select throws_ok(
  $$ select * from config.resolver_permissoes_modulo('00000000-0000-0000-0000-000000000003') $$,
  '42501', null, 'colaborador NAO resolve permissoes de outro usuario'
);

reset role;

-- ─────────────────────────── RLS DE DOMÍNIO POR MÓDULO ─────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","user_role":"colaborador","user_modulos":{"pcm":"leitura","atendimento":"leitura"}}';
select is((select count(*) from pcm.clientes)::int, 1, 'pcm leitura le pcm.clientes');
select throws_ok(
  $$ insert into pcm.clientes (nome, created_by) values ('x', '00000000-0000-0000-0000-000000000003') $$,
  '42501', null, 'pcm leitura NAO insere pcm.clientes'
);
select is((select count(*) from atendimento.config_ze)::int, 1, 'atendimento leitura le atendimento.config_ze');
select throws_ok(
  $$ insert into atendimento.wa_queue (queue_key, wait_until) values ('x', now()) $$,
  '42501', null, 'atendimento leitura NAO insere atendimento.wa_queue'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","user_role":"colaborador","user_modulos":{"pcm":"escrita","comercial":"leitura"}}';
select lives_ok(
  $$ insert into pcm.clientes (nome, created_by) values ('pcm escrita', '00000000-0000-0000-0000-000000000004') $$,
  'pcm escrita insere pcm.clientes'
);
select is((select count(*) from comercial.leads)::int, 1, 'comercial leitura le comercial.leads');
select throws_ok(
  $$ insert into comercial.leads (nome, created_by) values ('lead proibido', '00000000-0000-0000-0000-000000000004') $$,
  '42501', null, 'comercial leitura NAO insere comercial.leads'
);
select is((select count(*) from atendimento.config_ze)::int, 0, 'sem modulo atendimento NAO le atendimento.config_ze');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","user_role":"superadmin","user_modulos":{}}';
select is((select count(*) from atendimento.config_ze)::int, 1, 'superadmin bypassa user_modulos vazio');
select lives_ok(
  $$ insert into comercial.leads (nome, created_by) values ('lead superadmin', '00000000-0000-0000-0000-000000000001') $$,
  'superadmin escreve sem user_modulos'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","user_role":"supervisor","user_modulos":{}}';
select is((select count(*) from config.feature_flags)::int, 0, 'supervisor NAO le feature_flags');
select throws_ok(
  $$ update config.usuarios set papel = 'superadmin' where user_id = '00000000-0000-0000-0000-000000000003' $$,
  '42501', null, 'supervisor NAO promove para superadmin'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","user_role":"cliente-sindico","user_modulos":{}}';
select is((select count(*) from pcm.clientes)::int, 0, 'cliente-sindico sem modulo NAO le pcm.clientes');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","user_role":"colaborador","user_modulos":{}}';
select is((select count(*) from pcm.clientes)::int, 0, 'usuario inativo sem user_modulos NAO le pcm.clientes');

reset role;

select * from finish();
rollback;
