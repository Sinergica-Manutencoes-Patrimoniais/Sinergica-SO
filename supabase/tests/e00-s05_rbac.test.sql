-- e00-s05_rbac.test.sql — pgTAP: prova a matriz de decisão de RLS por papel (spec.md AC-8, AC-9)
-- Rodar com: supabase test db (requer `supabase start` local — ver db/rls-test.md)
--
-- Estratégia: simula 5 identidades via request.jwt.claims (admin, escritorio, tecnico,
-- cliente-sindico, sem-papel) contra as 7 tabelas da matriz de decisão. Seed inicial roda como
-- `postgres` (superuser local, bypassa RLS) para existir 1 linha por tabela a enxergar/não
-- enxergar. Cada bloco fecha com `reset role`.

begin;
select plan(29);

-- ─────────────────────────── SEED (como superuser) ─────────────────────────

-- Usuários fake em auth.users (mínimo exigido pelo schema local do GoTrue)
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'escritorio@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tecnico@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sindico@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sem-papel@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- config.usuarios — nota: '000...005' NÃO tem linha aqui (é o caso "sem perfil", AC-9)
select config.provisionar_usuario('00000000-0000-0000-0000-000000000001', 'admin', 'Admin Teste');
select config.provisionar_usuario('00000000-0000-0000-0000-000000000002', 'escritorio', 'Escritorio Teste');
select config.provisionar_usuario('00000000-0000-0000-0000-000000000003', 'tecnico', 'Tecnico Teste');
select config.provisionar_usuario('00000000-0000-0000-0000-000000000004', 'cliente-sindico', 'Sindico Teste');

-- 1 linha por tabela de domínio (seed via superuser, bypassa RLS)
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

-- ─────────────────────────── HELPER ────────────────────────────────────────
-- set_papel(uuid, papel|null) → seta o contexto de authenticated simulando o JWT pós-hook

-- ═══════════════════════ pcm.clientes ═══════════════════════════════════════
-- select: admin, escritorio, tecnico | insert/update: admin, escritorio

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","user_role":"tecnico"}';
select is((select count(*) from pcm.clientes)::int, 1, 'tecnico le pcm.clientes');
select throws_ok(
  $$ insert into pcm.clientes (nome, created_by) values ('x', '00000000-0000-0000-0000-000000000003') $$,
  '42501', null, 'tecnico NAO insere em pcm.clientes'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","user_role":"escritorio"}';
select lives_ok(
  $$ insert into pcm.clientes (nome, created_by) values ('y', '00000000-0000-0000-0000-000000000002') $$,
  'escritorio insere em pcm.clientes'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","user_role":"cliente-sindico"}';
select is((select count(*) from pcm.clientes)::int, 0, 'cliente-sindico NAO le pcm.clientes');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005"}'; -- sem user_role
select is((select count(*) from pcm.clientes)::int, 0, 'sem papel NAO le pcm.clientes (AC-9)');

reset role;

-- ═══════════════════════ pcm.ordens_servico ═════════════════════════════════
-- select: admin, escritorio, tecnico | insert/update: admin, escritorio

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","user_role":"tecnico"}';
select is((select count(*) from pcm.ordens_servico)::int, 1, 'tecnico le pcm.ordens_servico');
select throws_ok(
  $$ update pcm.ordens_servico set titulo = 'alterado' where id = '20000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'tecnico NAO edita pcm.ordens_servico'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","user_role":"escritorio"}';
select lives_ok(
  $$ update pcm.ordens_servico set titulo = 'alterado por escritorio' where id = '20000000-0000-0000-0000-000000000001' $$,
  'escritorio edita pcm.ordens_servico'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","user_role":"cliente-sindico"}';
select is((select count(*) from pcm.ordens_servico)::int, 0, 'cliente-sindico NAO le pcm.ordens_servico');

reset role;

-- ═══════════════════════ atendimento.* ═══════════════════════════════════════
-- select/insert/update: admin, escritorio | tecnico e cliente-sindico SEM acesso

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","user_role":"escritorio"}';
select is((select count(*) from atendimento.config_ze)::int, 1, 'escritorio le atendimento.config_ze');
select is((select count(*) from atendimento.wa_messages)::int, 1, 'escritorio le atendimento.wa_messages');
select is((select count(*) from atendimento.wa_queue)::int, 1, 'escritorio le atendimento.wa_queue');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","user_role":"tecnico"}';
select is((select count(*) from atendimento.config_ze)::int, 0, 'tecnico NAO le atendimento.config_ze');
select is((select count(*) from atendimento.wa_messages)::int, 0, 'tecnico NAO le atendimento.wa_messages');
select is((select count(*) from atendimento.wa_queue)::int, 0, 'tecnico NAO le atendimento.wa_queue');
select throws_ok(
  $$ insert into atendimento.wa_queue (queue_key, wait_until) values ('x', now()) $$,
  '42501', null, 'tecnico NAO insere em atendimento.wa_queue'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","user_role":"cliente-sindico"}';
select is((select count(*) from atendimento.config_ze)::int, 0, 'cliente-sindico NAO le atendimento.config_ze');

reset role;

-- ═══════════════════════ comercial.leads ═════════════════════════════════════
-- select/insert/update: admin, escritorio | demais SEM acesso

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","user_role":"admin"}';
select is((select count(*) from comercial.leads)::int, 1, 'admin le comercial.leads');
select lives_ok(
  $$ insert into comercial.leads (nome, created_by) values ('lead admin', '00000000-0000-0000-0000-000000000001') $$,
  'admin insere em comercial.leads'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","user_role":"tecnico"}';
select is((select count(*) from comercial.leads)::int, 0, 'tecnico NAO le comercial.leads');
select throws_ok(
  $$ insert into comercial.leads (nome, created_by) values ('x', '00000000-0000-0000-0000-000000000003') $$,
  '42501', null, 'tecnico NAO insere em comercial.leads'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005"}';
select is((select count(*) from comercial.leads)::int, 0, 'sem papel NAO le comercial.leads (AC-9)');

reset role;

-- ═══════════════════════ config.feature_flags ═══════════════════════════════
-- select: admin, escritorio | insert/update: admin apenas

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","user_role":"escritorio"}';
select is((select count(*) from config.feature_flags)::int, 1, 'escritorio le config.feature_flags');
select throws_ok(
  $$ insert into config.feature_flags (chave) values ('nova_flag') $$,
  '42501', null, 'escritorio NAO insere em config.feature_flags (somente leitura)'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","user_role":"admin"}';
select lives_ok(
  $$ insert into config.feature_flags (chave) values ('flag_admin') $$,
  'admin insere em config.feature_flags'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","user_role":"tecnico"}';
select is((select count(*) from config.feature_flags)::int, 0, 'tecnico NAO le config.feature_flags');

reset role;

-- ═══════════════════════ config.usuarios (auto-referência) ═══════════════════

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","user_role":"tecnico"}';
select is(
  (select count(*) from config.usuarios where user_id = '00000000-0000-0000-0000-000000000003')::int, 1,
  'usuario le o proprio registro em config.usuarios'
);
select is(
  (select count(*) from config.usuarios where user_id <> '00000000-0000-0000-0000-000000000003')::int, 0,
  'usuario NAO le registro de outros em config.usuarios'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","user_role":"admin"}';
select is((select count(*) from config.usuarios)::int, 4, 'admin le todos os registros de config.usuarios');

reset role;

select * from finish();
rollback;
