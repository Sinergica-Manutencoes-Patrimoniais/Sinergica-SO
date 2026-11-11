-- E01-S186 (ferramenta de homologação por ondas, 1092/1104/1482/1483) — prova real de ponta a
-- ponta: registrar evidência de cenário CT → cancelar tentativa → tentativa cancelada nunca
-- reaparece → decisão de onda exige todos os cenários exigidos com 'passou', nunca decide com
-- verificação incompleta. Auditoria de 2026-11-10 encontrou zero pgTAP pras 32 migrations desta
-- story; ao escrever esta prova achei e corrigi (migration 1835) um bug real — a PRÓPRIA
-- ferramenta de homologação do programa nunca tinha `grant execute` liberado, inalcançável em
-- qualquer ambiente real.
begin;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18600000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's186-onda@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('18600000-0000-4000-8000-000000000001', 'superadmin', 'S186 Onda', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18600000-0000-4000-8000-000000000002', 'Cliente S186 A', true, '18600000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18600000-0000-4000-8000-000000000001', 'plano.gerir', '18600000-0000-4000-8000-000000000002');

set local request.jwt.claims = '{"sub":"18600000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  $$ select pcm.sso_registrar_evidencia_onda(gen_random_uuid(),'18600000-0000-4000-8000-000000000002',1::smallint,0,'CT-012','v1.0.0','staging',now(),'passou',array['id-1'],array['art-1'],'') $$,
  '55000', 'evidencias_desabilitadas', 'gate de evidências fechado por padrão recusa o registro'
);

reset role;
update pcm.sso_evidencias_ondas_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18600000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  $$ select pcm.sso_registrar_evidencia_onda(gen_random_uuid(),'18600000-0000-4000-8000-000000000002',1::smallint,0,'CT-999','v1.0.0','staging',now(),'passou',array['id-1'],array['art-1'],'') $$,
  '22023', 'parametros_invalidos', 'cenário fora do padrão CT-NNN é recusado'
);

select (pcm.sso_registrar_evidencia_onda('18600000-0000-4000-8000-000000000031', '18600000-0000-4000-8000-000000000002', 1::smallint, 0,
  'CT-012', 'v1.0.0', 'staging', '2026-11-10T10:00:00Z', 'passou', array['os-001'], array['run-001'], '')) as evidencia_1 \gset
select is((:'evidencia_1'::jsonb->>'revision')::int, 1, 'primeira evidência registra na revisão 1');

select is(
  (pcm.sso_registrar_evidencia_onda('18600000-0000-4000-8000-000000000031', '18600000-0000-4000-8000-000000000002', 1::smallint, 0,
    'CT-012', 'v1.0.0', 'staging', '2026-11-10T10:00:00Z', 'passou', array['os-001'], array['run-001'], ''))::jsonb->>'id',
  :'evidencia_1'::jsonb->>'id', 'replay do mesmo requestId devolve o mesmo resultado, sem duplicar'
);

select throws_ok(
  $$ select pcm.sso_registrar_evidencia_onda(gen_random_uuid(),'18600000-0000-4000-8000-000000000002',1::smallint,0,'CT-013','v1.0.0','staging',now(),'passou',array['id-2'],array['art-2'],'') $$,
  '40001', 'revisao_obsoleta', 'expected_revision desatualizado (0, já virou 1) é recusado'
);

select (pcm.sso_registrar_evidencia_onda('18600000-0000-4000-8000-000000000032', '18600000-0000-4000-8000-000000000002', 1::smallint, 1,
  'CT-013', 'v1.0.0', 'staging', '2026-11-10T10:05:00Z', 'passou', array['os-002'], array['run-002'], '')) as evidencia_2 \gset
select is((:'evidencia_2'::jsonb->>'revision')::int, 2, 'segunda evidência incrementa a revisão da onda');

select (pcm.sso_registrar_evidencia_onda('18600000-0000-4000-8000-000000000033', '18600000-0000-4000-8000-000000000002', 1::smallint, 2,
  'CT-014', 'v1.0.0', 'staging', '2026-11-10T10:10:00Z', 'passou', array['os-003'], array['run-003'], '')) as evidencia_3 \gset

reset role;

select throws_ok(
  format($f$ select pcm.sso_cancelar_tentativa_evidencia_onda(%L,%L,gen_random_uuid(),1::smallint) $f$,
    '18600000-0000-4000-8000-000000000001', '18600000-0000-4000-8000-000000000002'),
  '55000', 'cancelamento_desabilitado', 'gate de cancelamento fechado por padrão recusa'
);

update pcm.sso_cancelamento_evidencia_onda_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18600000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select is(
  (pcm.sso_cancelar_tentativa_evidencia_onda('18600000-0000-4000-8000-000000000001', '18600000-0000-4000-8000-000000000002',
    (:'evidencia_1'::jsonb->>'requestId')::uuid, 1::smallint))::jsonb->>'estado',
  'confirmado', 'requestId que já é uma evidência confirmada não é cancelado, só devolve o estado real'
);

select (pcm.sso_cancelar_tentativa_evidencia_onda('18600000-0000-4000-8000-000000000001', '18600000-0000-4000-8000-000000000002',
  '18600000-0000-4000-8000-000000000034', 1::smallint)) as cancelamento_1 \gset
select is(:'cancelamento_1'::jsonb->>'estado', 'cancelado', 'tentativa nunca confirmada é cancelada com sucesso');

select throws_ok(
  $$ select pcm.sso_registrar_evidencia_onda('18600000-0000-4000-8000-000000000034','18600000-0000-4000-8000-000000000002',1::smallint,3,'CT-015','v1.0.0','staging',now(),'passou',array['id-x'],array['art-x'],'') $$,
  '55000', 'tentativa_cancelada', 'requestId já cancelado nunca vira evidência, mesmo tentando de novo'
);

select (pcm.sso_registrar_evidencia_onda('18600000-0000-4000-8000-000000000035', '18600000-0000-4000-8000-000000000002', 1::smallint, 3,
  'CT-015', 'v1.0.0', 'staging', '2026-11-10T10:15:00Z', 'passou', array['os-004'], array['run-004'], '')) as evidencia_4 \gset
select is((:'evidencia_4'::jsonb->>'revision')::int, 4, 'quarta evidência (CT-015) fecha o conjunto exigido da onda 1');

reset role;
update pcm.sso_decisao_onda_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18600000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  $$ select pcm.sso_registrar_decisao_onda(gen_random_uuid(),'18600000-0000-4000-8000-000000000002',1::smallint,4,'v1.0.0','staging','{"arvore_busca":"ref-1"}'::jsonb,'') $$,
  '22023', 'verificacoes_incompletas', 'faltar uma das verificações exigidas da onda é recusado'
);

select (pcm.sso_registrar_decisao_onda('18600000-0000-4000-8000-000000000036', '18600000-0000-4000-8000-000000000002', 1::smallint, 4,
  'v1.0.0', 'staging', '{"arvore_busca":"ref-arvore-1","validacao_cadastral":"ref-cadastral-1"}'::jsonb, '')) as decisao_1 \gset
select ok(:'decisao_1'::jsonb->>'id' is not null, 'onda 1 decidida com todos os cenários CT passando e verificações completas');

reset role;
select is(
  (select jsonb_array_length(evidencias) from pcm.sso_decisoes_onda where id = (:'decisao_1'::jsonb->>'id')::uuid),
  4, 'decisão registra as 4 evidências que a sustentam, uma por cenário exigido'
);

select throws_ok(
  $$ update pcm.sso_decisoes_onda set ressalva = 'editado' where true $$,
  '23514', 'decisao_imutavel', 'decisão de onda é append-only, nunca editada'
);

select * from finish();
rollback;
