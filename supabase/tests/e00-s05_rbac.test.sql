-- e00-s05_rbac.test.sql — pgTAP: prova a matriz de decisão de RLS por papel (spec.md AC-8, AC-9)
-- Rodar com: supabase test db (requer `supabase start` local — ver db/rls-test.md)
--
-- Papéis renomeados em E00-S08 (admin→superadmin, escritorio→supervisor, tecnico→colaborador;
-- cliente-sindico inalterado) — mesma matriz de permissão de E00-S05, ver
-- specs/E00-S08-renomear-papeis-rbac/spec.md.
--
-- Estratégia: simula 5 identidades via request.jwt.claims (superadmin, supervisor, colaborador,
-- cliente-sindico, sem-papel) contra as 7 tabelas da matriz de decisão. Seed inicial roda como
-- `postgres` (superuser local, bypassa RLS) para existir 1 linha por tabela a enxergar/não
-- enxergar. Cada bloco fecha com `reset role`.

begin;
select plan(29);

-- ─────────────────────────── SEED (como superuser) ─────────────────────────

-- Usuários fake em auth.users (mínimo exigido pelo schema local do GoTrue)
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'superadmin@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'supervisor@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'colaborador@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sindico@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sem-papel@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- config.usuarios — nota: '000...005' NÃO tem linha aqui (é o caso "sem perfil", AC-9)
select config.provisionar_usuario('00000000-0000-0000-0000-000000000001', 'superadmin', 'Superadmin Teste');
select config.provisionar_usuario('00000000-0000-0000-0000-000000000002', 'supervisor', 'Supervisor Teste');
select config.provisionar_usuario('00000000-0000-0000-0000-000000000003', 'colaborador', 'Colaborador Teste');
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
-- select: superadmin, supervisor, colaborador | insert/update: superadmin, supervisor

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","user_role":"colaborador"}';
select is((select count(*) from pcm.clientes)::int, 1, 'colaborador le pcm.clientes');
select throws_ok(
  $$ insert into pcm.clientes (nome, created_by) values ('x', '00000000-0000-0000-0000-000000000003') $$,
  '42501', null, 'colaborador NAO insere em pcm.clientes'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","user_role":"supervisor"}';
select lives_ok(
  $$ insert into pcm.clientes (nome, created_by) values ('y', '00000000-0000-0000-0000-000000000002') $$,
  'supervisor insere em pcm.clientes'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","user_role":"cliente-sindico"}';
select is((select count(*) from pcm.clientes)::int, 0, 'cliente-sindico NAO le pcm.clientes');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005"}'; -- sem user_role
select is((select count(*) from pcm.clientes)::int, 0, 'sem papel NAO le pcm.clientes (AC-9)');

reset role;

-- ═══════════════════════ pcm.ordens_servico ═════════════════════════════════
-- select: superadmin, supervisor, colaborador | insert/update: superadmin, supervisor

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","user_role":"colaborador"}';
select is((select count(*) from pcm.ordens_servico)::int, 1, 'colaborador le pcm.ordens_servico');
-- UPDATE bloqueado pela USING da policy não lança 42501 (diferente de INSERT/WITH CHECK) — a
-- policy simplesmente não seleciona nenhuma linha para atualizar. O gate real é "0 linhas
-- afetadas", não exceção.
update pcm.ordens_servico set titulo = 'colaborador tentou alterar' where id = '20000000-0000-0000-0000-000000000001';
select is(
  (select titulo from pcm.ordens_servico where id = '20000000-0000-0000-0000-000000000001'),
  'OS de teste',
  'colaborador NAO edita pcm.ordens_servico (RLS filtra a linha — 0 afetadas)'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","user_role":"supervisor"}';
select lives_ok(
  $$ update pcm.ordens_servico set titulo = 'alterado por supervisor' where id = '20000000-0000-0000-0000-000000000001' $$,
  'supervisor edita pcm.ordens_servico'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","user_role":"cliente-sindico"}';
select is((select count(*) from pcm.ordens_servico)::int, 0, 'cliente-sindico NAO le pcm.ordens_servico');

reset role;

-- ═══════════════════════ atendimento.* ═══════════════════════════════════════
-- select/insert/update: superadmin, supervisor | colaborador e cliente-sindico SEM acesso

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","user_role":"supervisor"}';
select is((select count(*) from atendimento.config_ze)::int, 1, 'supervisor le atendimento.config_ze');
select is((select count(*) from atendimento.wa_messages)::int, 1, 'supervisor le atendimento.wa_messages');
select is((select count(*) from atendimento.wa_queue)::int, 1, 'supervisor le atendimento.wa_queue');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","user_role":"colaborador"}';
select is((select count(*) from atendimento.config_ze)::int, 0, 'colaborador NAO le atendimento.config_ze');
select is((select count(*) from atendimento.wa_messages)::int, 0, 'colaborador NAO le atendimento.wa_messages');
select is((select count(*) from atendimento.wa_queue)::int, 0, 'colaborador NAO le atendimento.wa_queue');
select throws_ok(
  $$ insert into atendimento.wa_queue (queue_key, wait_until) values ('x', now()) $$,
  '42501', null, 'colaborador NAO insere em atendimento.wa_queue'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","user_role":"cliente-sindico"}';
select is((select count(*) from atendimento.config_ze)::int, 0, 'cliente-sindico NAO le atendimento.config_ze');

reset role;

-- ═══════════════════════ comercial.leads ═════════════════════════════════════
-- select/insert/update: superadmin, supervisor | demais SEM acesso

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","user_role":"superadmin"}';
select is((select count(*) from comercial.leads)::int, 1, 'superadmin le comercial.leads');
select lives_ok(
  $$ insert into comercial.leads (nome, created_by) values ('lead superadmin', '00000000-0000-0000-0000-000000000001') $$,
  'superadmin insere em comercial.leads'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","user_role":"colaborador"}';
select is((select count(*) from comercial.leads)::int, 0, 'colaborador NAO le comercial.leads');
select throws_ok(
  $$ insert into comercial.leads (nome, created_by) values ('x', '00000000-0000-0000-0000-000000000003') $$,
  '42501', null, 'colaborador NAO insere em comercial.leads'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005"}';
select is((select count(*) from comercial.leads)::int, 0, 'sem papel NAO le comercial.leads (AC-9)');

reset role;

-- ═══════════════════════ config.feature_flags ═══════════════════════════════
-- select: superadmin, supervisor | insert/update: superadmin apenas

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","user_role":"supervisor"}';
select is((select count(*) from config.feature_flags)::int, 1, 'supervisor le config.feature_flags');
select throws_ok(
  $$ insert into config.feature_flags (chave) values ('nova_flag') $$,
  '42501', null, 'supervisor NAO insere em config.feature_flags (somente leitura)'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","user_role":"superadmin"}';
select lives_ok(
  $$ insert into config.feature_flags (chave) values ('flag_superadmin') $$,
  'superadmin insere em config.feature_flags'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","user_role":"colaborador"}';
select is((select count(*) from config.feature_flags)::int, 0, 'colaborador NAO le config.feature_flags');

reset role;

-- ═══════════════════════ config.usuarios (auto-referência) ═══════════════════

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","user_role":"colaborador"}';
select is(
  (select count(*) from config.usuarios where user_id = '00000000-0000-0000-0000-000000000003')::int, 1,
  'usuario le o proprio registro em config.usuarios'
);
select is(
  (select count(*) from config.usuarios where user_id <> '00000000-0000-0000-0000-000000000003')::int, 0,
  'usuario NAO le registro de outros em config.usuarios'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","user_role":"superadmin"}';
select is((select count(*) from config.usuarios)::int, 4, 'superadmin le todos os registros de config.usuarios');

reset role;

select * from finish();
rollback;
