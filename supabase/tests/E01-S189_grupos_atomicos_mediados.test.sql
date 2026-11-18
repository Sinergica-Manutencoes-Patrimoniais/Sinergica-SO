-- E01-S189 (estrutura) — alcance de config.sso_criar_grupo_atomico e
-- config.sso_editar_grupo_idempotente, que escrevem SEM gate. Autorização aqui é por PAPEL
-- (superadmin/supervisor), não por concessão com Cliente — por isso o "sem acesso" é um
-- colaborador, não um superadmin sem concessão.
begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18890000-0000-4000-8000-000000000031', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's189-grupo@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18890000-0000-4000-8000-000000000032', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's189-grupo-sem@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18890000-0000-4000-8000-000000000031', 'superadmin', 'S189 Grupo', true),
 ('18890000-0000-4000-8000-000000000032', 'colaborador', 'S189 Grupo Colaborador', true);

-- ── AC-1: criar grupo — gate fechado por padrão ───────────────────────────────────────────
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000031","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  format($f$ select config.sso_criar_grupo_atomico_mediada(%L,'Grupo S189','Descrição','[]'::jsonb,%L) $f$,
    '18890000-0000-4000-8000-00000000033a', '18890000-0000-4000-8000-000000000031'),
  '55000', 'grupo_atomico_indisponivel', 'gate de criação de grupo fechado por padrão recusa com erro nomeado'
);

-- ── AC-3: gate aberto, mas colaborador (sem papel superadmin/supervisor) continua recusado ─
reset role;
update config.sso_grupo_atomico_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000032","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok(
  format($f$ select config.sso_criar_grupo_atomico_mediada(%L,'Grupo S189 B','Descrição','[]'::jsonb,%L) $f$,
    '18890000-0000-4000-8000-00000000033b', '18890000-0000-4000-8000-000000000032'),
  '42501', 'sem_acesso', 'gate aberto não basta sem o papel superadmin/supervisor'
);

-- ── AC-2: gate aberto + papel correto cria de verdade, e é idempotente ───────────────────
reset role;
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000031","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select lives_ok(
  format($f$ select config.sso_criar_grupo_atomico_mediada(%L,'Grupo S189','Descrição','[]'::jsonb,%L) $f$,
    '18890000-0000-4000-8000-00000000033a', '18890000-0000-4000-8000-000000000031'),
  'com o gate aberto e papel correto, o grupo é criado de verdade'
);
select lives_ok(
  format($f$ select config.sso_criar_grupo_atomico_mediada(%L,'Grupo S189','Descrição','[]'::jsonb,%L) $f$,
    '18890000-0000-4000-8000-00000000033a', '18890000-0000-4000-8000-000000000031'),
  'replay do mesmo id (idempotente por construção, igual no núcleo) não quebra'
);
reset role;
select is((select count(*)::int from config.grupos where id = '18890000-0000-4000-8000-00000000033a'), 1,
  'exatamente um grupo gravado, não dois');

-- ── Editar: mesmo padrão, gate próprio ────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000031","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  format($f$ select config.sso_editar_grupo_idempotente_mediada(%L,%L,'{"nome":"Grupo S189 renomeado"}'::jsonb,null,
      jsonb_build_object('nome','Grupo S189','descricao','Descrição','ativo',true,'permissoes','[]'::jsonb),%L) $f$,
    '18890000-0000-4000-8000-00000000034a', '18890000-0000-4000-8000-00000000033a', '18890000-0000-4000-8000-000000000031'),
  '55000', 'edicao_grupo_indisponivel', 'gate de edição de grupo fechado por padrão recusa com erro nomeado'
);

reset role;
update config.sso_edicao_grupo_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000031","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select lives_ok(
  format($f$ select config.sso_editar_grupo_idempotente_mediada(%L,%L,'{"nome":"Grupo S189 renomeado"}'::jsonb,null,
      jsonb_build_object('nome','Grupo S189','descricao','Descrição','ativo',true,'permissoes','[]'::jsonb),%L) $f$,
    '18890000-0000-4000-8000-00000000034a', '18890000-0000-4000-8000-00000000033a', '18890000-0000-4000-8000-000000000031'),
  'com o gate aberto, a edição é aplicada de verdade'
);
reset role;
select is((select nome from config.grupos where id = '18890000-0000-4000-8000-00000000033a'), 'Grupo S189 renomeado',
  'o nome foi efetivamente alterado');

-- ── Os dois núcleos continuam revogados ───────────────────────────────────────────────────
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'config' and p.proname in ('sso_criar_grupo_atomico', 'sso_editar_grupo_idempotente')
       and has_function_privilege('authenticated', p.oid, 'execute')),
  0, 'os dois núcleos de grupo continuam revogados de authenticated'
);

select * from finish();
rollback;
