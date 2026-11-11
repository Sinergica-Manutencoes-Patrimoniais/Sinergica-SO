-- E01-S185 AC-5 (tratar conflito e prevenir regressão) — prova real do fluxo de conflito
-- webhook×Chamado encerrado (migrations 1030/1032/1035): captura mínima e privada (sem efeito
-- externo), listagem com isolamento de Cliente, resolução só com confirmação remota explícita e
-- concorrência otimista contra o estado real da OS (nunca confia no payload do operador sozinho).
-- Auditoria de 2026-11-11 encontrou zero pgTAP pras 82 migrations desta story — primeira prova real.
begin;
select plan(17);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18500000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's185-conflito@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('18500000-0000-4000-8000-000000000001', 'superadmin', 'S185 Conflito', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18500000-0000-4000-8000-000000000002', 'Cliente S185 A', true, '18500000-0000-4000-8000-000000000001'),
 ('18500000-0000-4000-8000-000000000003', 'Cliente S185 B', true, '18500000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18500000-0000-4000-8000-000000000001', 'integracao.reconciliar', '18500000-0000-4000-8000-000000000002');

-- OS A: conflito que permanece divergente (status real difere do status relatado pelo webhook).
insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, status, auvo_task_id, created_by) values
 ('18500000-0000-4000-8000-000000000004', '18500000-0000-4000-8000-000000000002', 'OS-S185-A', 'OS conflito divergente', 'corretiva', 'solicitacao', 1850001, '18500000-0000-4000-8000-000000000001');
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by, ordem_servico_id, sso_encerrado_em) values
 ('18500000-0000-4000-8000-000000000005', 'CH-S185-A', '18500000-0000-4000-8000-000000000002', 'Chamado encerrado A', '18500000-0000-4000-8000-000000000001', '18500000-0000-4000-8000-000000000004', now());

-- OS B: conflito que se resolve (status real já bate com o que o webhook relatou).
insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, status, auvo_task_id, created_by) values
 ('18500000-0000-4000-8000-000000000006', '18500000-0000-4000-8000-000000000002', 'OS-S185-B', 'OS conflito alinhado', 'corretiva', 'cancelado', 1850002, '18500000-0000-4000-8000-000000000001');
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by, ordem_servico_id, sso_encerrado_em) values
 ('18500000-0000-4000-8000-000000000007', 'CH-S185-B', '18500000-0000-4000-8000-000000000002', 'Chamado encerrado B', '18500000-0000-4000-8000-000000000001', '18500000-0000-4000-8000-000000000006', now());

-- OS C: sem Chamado encerrado associado — não confirma conflito.
insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, status, auvo_task_id, created_by) values
 ('18500000-0000-4000-8000-000000000008', '18500000-0000-4000-8000-000000000002', 'OS-S185-C', 'OS sem chamado encerrado', 'corretiva', 'solicitacao', 1850003, '18500000-0000-4000-8000-000000000001');

set local role service_role;

select throws_ok(
  $$ select pcm.sso_registrar_conflito_webhook_chamado('18500000-0000-4000-8000-000000000004', 1850001, 'cancelado') $$,
  '55000', 'captura_conflito_bloqueada', 'gate de captura fechado por padrão recusa o registro'
);

reset role;
update pcm.sso_conflito_webhook_chamado_gate set habilitado = true where id;
set local role service_role;

select throws_ok(
  $$ select pcm.sso_registrar_conflito_webhook_chamado('18500000-0000-4000-8000-000000000004', 1850001, 'status_inexistente') $$,
  '22023', 'conflito_invalido', 'status_remoto fora do enum é recusado'
);

select throws_ok(
  $$ select pcm.sso_registrar_conflito_webhook_chamado('18500000-0000-4000-8000-000000000008', 1850003, 'cancelado') $$,
  '23514', 'conflito_nao_confirmado', 'OS sem Chamado encerrado associado não confirma conflito'
);

select (pcm.sso_registrar_conflito_webhook_chamado('18500000-0000-4000-8000-000000000004', 1850001, 'cancelado')) as conflito_a \gset
select ok(:'conflito_a' is not null, 'conflito A é registrado com sucesso');

select is(
  (pcm.sso_registrar_conflito_webhook_chamado('18500000-0000-4000-8000-000000000004', 1850001, 'cancelado')),
  :'conflito_a', 'registrar o mesmo conflito (ainda não resolvido) é idempotente, não duplica'
);

select (pcm.sso_registrar_conflito_webhook_chamado('18500000-0000-4000-8000-000000000006', 1850002, 'cancelado')) as conflito_b \gset

reset role;
set local request.jwt.claims = '{"sub":"18500000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

-- Núcleo (1032) é privado (sem grant algum); único caminho alcançável é a mediação (1034),
-- `sso_listar_conflitos_webhook_autorizado`, atrás do próprio gate dela.
select throws_ok(
  format($f$ select pcm.sso_listar_conflitos_webhook_autorizado(%L,%L,null,null,10) $f$, '18500000-0000-4000-8000-000000000002', '18500000-0000-4000-8000-000000000004'),
  '55000', 'consulta_conflito_bloqueada', 'gate de consulta mediada fechado recusa a listagem'
);

reset role;
update pcm.sso_consulta_conflitos_webhook_gate set habilitado = true where id;
update pcm.reconciliacao_outbox_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18500000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select pcm.sso_listar_conflitos_webhook_autorizado(%L,%L,null,null,10) $f$, '18500000-0000-4000-8000-000000000003', '18500000-0000-4000-8000-000000000004'),
  '42501', 'os_nao_encontrada_ou_sem_acesso', 'Cliente divergente não lista conflitos de OS de outro Cliente'
);

select is(
  (select count(*)::int from pcm.sso_listar_conflitos_webhook_autorizado('18500000-0000-4000-8000-000000000002', '18500000-0000-4000-8000-000000000004', null, null, 10)),
  1, 'conflito A aparece na listagem da OS certa'
);
select is(
  (select status_remoto from pcm.sso_listar_conflitos_webhook_autorizado('18500000-0000-4000-8000-000000000002', '18500000-0000-4000-8000-000000000004', null, null, 10) limit 1),
  'cancelado', 'status_remoto relatado pelo webhook é preservado na listagem'
);

select throws_ok(
  format($f$ select pcm.sso_resolver_conflito_webhook_chamado(gen_random_uuid(),%L,%L,now(),1850001,'solicitacao',true) $f$,
    '18500000-0000-4000-8000-000000000002', :'conflito_a'),
  '55000', 'resolucao_conflito_bloqueada', 'gate de resolução fechado recusa a decisão'
);

reset role;
update pcm.sso_resolucao_conflito_webhook_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18500000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select pcm.sso_resolver_conflito_webhook_chamado(gen_random_uuid(),%L,%L,%L,1850001,'solicitacao',true) $f$,
    '18500000-0000-4000-8000-000000000002', :'conflito_a', (now() - interval '1 hour')::text),
  '40001', 'origem_alterada', 'os_updated_at divergente (stale) é recusado, nunca confia cego no cliente'
);

select throws_ok(
  format($f$ select pcm.sso_resolver_conflito_webhook_chamado(gen_random_uuid(),%L,%L,(select coalesce(updated_at,created_at) from pcm.ordens_servico where id=%L),1850001,'solicitacao',true) $f$,
    '18500000-0000-4000-8000-000000000002', :'conflito_a', '18500000-0000-4000-8000-000000000004'),
  '23514', 'status_ainda_divergente', 'status real da OS ainda diverge do relatado pelo webhook, resolução recusada'
);

select (pcm.sso_resolver_conflito_webhook_chamado('18500000-0000-4000-8000-000000000031', '18500000-0000-4000-8000-000000000002', :'conflito_b',
  (select coalesce(updated_at, created_at) from pcm.ordens_servico where id = '18500000-0000-4000-8000-000000000006'),
  1850002, 'cancelado', true)) as resolucao_b \gset
select is(:'resolucao_b'::jsonb->>'conflitoId', :'conflito_b', 'conflito B (status já alinhado) é resolvido com sucesso');

select is(
  (pcm.sso_resolver_conflito_webhook_chamado('18500000-0000-4000-8000-000000000031', '18500000-0000-4000-8000-000000000002', :'conflito_b',
    (select coalesce(updated_at, created_at) from pcm.ordens_servico where id = '18500000-0000-4000-8000-000000000006'),
    1850002, 'cancelado', true))::jsonb->>'conflitoId',
  :'conflito_b', 'replay do mesmo requestId devolve o mesmo resultado, sem reprocessar'
);

select throws_ok(
  format($f$ select pcm.sso_resolver_conflito_webhook_chamado(gen_random_uuid(),%L,%L,(select coalesce(updated_at,created_at) from pcm.ordens_servico where id=%L),1850002,'cancelado',true) $f$,
    '18500000-0000-4000-8000-000000000002', :'conflito_b', '18500000-0000-4000-8000-000000000006'),
  '23514', 'conflito_ja_resolvido', 'conflito já resolvido não é resolvido de novo'
);

reset role;
select is(
  (select count(*)::int from pcm.reconciliacao_webhook_chamado_conflitos where os_id = '18500000-0000-4000-8000-000000000004'),
  1, 'registrar o mesmo conflito duas vezes não insere segunda linha (unicidade por os_id/task_id/status enquanto não resolvido)'
);
select throws_ok(
  $$ update pcm.reconciliacao_webhook_chamado_decisoes set resultado = '{}'::jsonb where true $$,
  '23514', 'nota_imutavel', 'decisão de resolução é append-only, nunca editada'
);

select * from finish();
rollback;
