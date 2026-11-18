-- E01-S188 — diagnóstico, abertura e retorno de jornada (AC-4, AC-5, AC-6, AC-7, AC-8, AC-9).
--
-- Usa a jornada real 'central-materiais' (declarada na migration 1849) em vez de fixture
-- sintética: a prova vale mais contra o registro de verdade, e qualquer mudança nele que quebre
-- o diagnóstico aparece aqui primeiro.
begin;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18880000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's188-super@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18880000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's188-colaborador@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18880000-0000-4000-8000-000000000001', 'superadmin', 'S188 Super', true),
 ('18880000-0000-4000-8000-000000000002', 'colaborador', 'S188 Colaborador', true);

-- Estado inicial conhecido: gate fechado (é o padrão de toda feature nova).
update pcm.sso_eventos_materiais_mediados_gate set habilitado = false where id;

-- ── AC-5: não superadmin é recusado no diagnóstico ────────────────────────────────────────
set local request.jwt.claims = '{"sub":"18880000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok(
  $$ select config.sso_diagnosticar_jornada('central-materiais') $$,
  '42501', 'sem_acesso', 'colaborador não consulta o diagnóstico de ativação'
);
select throws_ok(
  $$ select config.sso_abrir_jornada(gen_random_uuid(), 'central-materiais', 'tentativa indevida') $$,
  '42501', 'sem_acesso', 'colaborador não abre jornada'
);
select throws_ok(
  $$ select * from config.sso_listar_jornadas() $$,
  '42501', 'sem_acesso', 'colaborador não lista as jornadas declaradas'
);

reset role;
set local request.jwt.claims = '{"sub":"18880000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

-- ── listagem para a tela não hardcodar código de jornada ──────────────────────────────────
select is(
  (select count(*)::int from config.sso_listar_jornadas() where codigo = 'central-materiais'),
  1, 'superadmin lista a jornada declarada'
);

-- ── AC-4: diagnóstico com gate fechado aponta exatamente a camada faltante ────────────────
select is(
  (config.sso_diagnosticar_jornada('central-materiais'))->>'utilizavel', 'false',
  'com o gate fechado, a jornada não está utilizável'
);
select is(
  jsonb_array_length((config.sso_diagnosticar_jornada('central-materiais'))->'faltando'), 1,
  'falta exatamente um item: o gate (grant e flag já estão prontos no registro real)'
);
select is(
  (config.sso_diagnosticar_jornada('central-materiais'))->'faltando'->0->>'identificador',
  'pcm.sso_eventos_materiais_mediados_gate', 'o item faltante é nomeado, não um "algo está errado" genérico'
);

-- ── AC-9: abrir com camada grant/flag ausente é recusado, mesmo com gate liberável ────────
-- Simula a lacuna revogando o grant por um instante, só para provar a recusa.
reset role;
revoke execute on function pcm.sso_informar_material_mediado(uuid, uuid, integer, text, jsonb) from authenticated;
set local request.jwt.claims = '{"sub":"18880000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  $$ select config.sso_abrir_jornada(gen_random_uuid(), 'central-materiais', 'teste sem grant') $$,
  '55000', 'ativacao_incompleta', 'abrir é recusado enquanto faltar grant — abrir gate sem as outras camadas não produz funcionalidade'
);
reset role;
grant execute on function pcm.sso_informar_material_mediado(uuid, uuid, integer, text, jsonb) to authenticated;
set local request.jwt.claims = '{"sub":"18880000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

-- ── AC-7: abrir de verdade, com tudo pronto exceto o gate ─────────────────────────────────
select (config.sso_abrir_jornada('18880000-0000-4000-8000-0000000000e1', 'central-materiais', 'piloto de teste')) as abertura \gset
select is(:'abertura'::jsonb->>'reutilizado', 'false', 'primeira abertura não é replay');
select is(
  (config.sso_diagnosticar_jornada('central-materiais'))->>'utilizavel', 'true',
  'depois de abrir, o diagnóstico confirma utilizável'
);

reset role;
select is(
  (select habilitado from pcm.sso_eventos_materiais_mediados_gate where id), true,
  'o gate foi efetivamente aberto'
);
select is(
  (select count(*)::int from config.sso_jornada_eventos where request_id = '18880000-0000-4000-8000-0000000000e1'),
  1, 'um evento de abertura foi registrado, auditável'
);
set local request.jwt.claims = '{"sub":"18880000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

-- Replay do mesmo request_id: no-op, devolve o mesmo resultado, não duplica evento.
select is(
  (config.sso_abrir_jornada('18880000-0000-4000-8000-0000000000e1', 'central-materiais', 'piloto de teste'))->>'reutilizado',
  'true', 'reexecutar a mesma abertura é reconhecida como replay'
);
reset role;
select is(
  (select count(*)::int from config.sso_jornada_eventos where request_id = '18880000-0000-4000-8000-0000000000e1'),
  1, 'replay não duplica o evento de auditoria'
);
set local request.jwt.claims = '{"sub":"18880000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

-- ── AC-8: retornar fecha o gate de volta, sem apagar nada produzido ───────────────────────
-- "dado produzido" aqui é simulado pelo próprio evento de abertura, que tem que sobreviver.
select (config.sso_retornar_jornada('18880000-0000-4000-8000-0000000000e2', 'central-materiais', 'fim do piloto de teste')) as retorno \gset
reset role;
select is(
  (select habilitado from pcm.sso_eventos_materiais_mediados_gate where id), false,
  'retornar fecha o gate de volta ao estado inicial'
);
select is(
  (select count(*)::int from config.sso_jornada_eventos where request_id = '18880000-0000-4000-8000-0000000000e1'),
  1, 'o evento de abertura anterior continua existindo — retornar não apaga histórico'
);

select * from finish();
rollback;
