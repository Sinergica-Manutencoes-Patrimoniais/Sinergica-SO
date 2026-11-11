-- E01-S175 AC-5 (dedup/concorrência webhook+polling) — prova real da inbox privada de origem de
-- campo (0357/0358) e do wrapper idempotente (1419): recebimento de envelope com unicidade
-- (integracao,task_id,chave_evento), reentrega idêntica não duplica, conteúdo divergente é
-- recusado; resolução cliente/OS por auvo_id (nunca por id interno fornecido de fora); replay da
-- MESMA resolução (estado inalterado) reaproveita sem inserir novo histórico; cliente divergente
-- nunca vincula OS de outro Cliente. Auditoria de 2026-11-10 encontrou zero pgTAP cobrindo este
-- pipeline apesar de 38 migrations reais de schema/RPC — esta é a primeira prova real.
--
-- `auth.role()` lê de `request.jwt.claims`/`request.jwt.claim.role` (GUC), não do papel real do
-- Postgres — por isso `set local role service_role` sozinho NÃO basta pras funções desta migration
-- que checam `auth.role() = 'service_role'` por dentro; é preciso setar o claim também.
begin;
select plan(20);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('17500000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's175-inbox@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('17500000-0000-4000-8000-000000000001', 'superadmin', 'S175 Inbox', true);
insert into pcm.clientes (id, nome, ativo, auvo_id, created_by) values
 ('17500000-0000-4000-8000-000000000002', 'Cliente S175 A', true, 1750001, '17500000-0000-4000-8000-000000000001'),
 ('17500000-0000-4000-8000-000000000003', 'Cliente S175 B', true, 1750002, '17500000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, auvo_task_id, created_by) values
 ('17500000-0000-4000-8000-000000000004', '17500000-0000-4000-8000-000000000002', 'OS-S175-001', 'OS do Cliente A', 'corretiva', 1750011, '17500000-0000-4000-8000-000000000001');

set local request.jwt.claims = '{"sub":"17500000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  $$ select pcm.origem_campo_inbox_gate.id from pcm.origem_campo_inbox_gate $$,
  '42501', null, 'authenticated não lê a tabela da inbox direto (revoke all, nem leitura)'
);

set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select throws_ok(
  $$ select pcm.sso_receber_envelope_origem_campo('auvo', 1750011, 'evt-gate-fechado', '1750001', now(), '{"a":1}'::jsonb) $$,
  '55000', 'inbox_origem_campo_bloqueada', 'gate fechado por padrão recusa o recebimento'
);

reset role;
update pcm.origem_campo_inbox_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"17500000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  $$ select pcm.sso_receber_envelope_origem_campo('auvo', 1750011, 'evt-nao-servico', '1750001', now(), '{"a":1}'::jsonb) $$,
  '42501', null, 'authenticated não tem execute grant nessa função, só service_role (migration 1418)'
);

set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select throws_ok(
  $$ select pcm.sso_receber_envelope_origem_campo('auvo', 0, 'evt-invalido', '1750001', now(), '{"a":1}'::jsonb) $$,
  '22023', 'envelope_invalido', 'task_id inválido (< 1) é recusado'
);

select (pcm.sso_receber_envelope_origem_campo('auvo', 1750011, 'evt-recebida-1', '1750001', '2026-11-10T10:00:00Z', '{"evento":"criada"}'::jsonb)) as recibo_criacao \gset
select is((:'recibo_criacao'::jsonb->>'criado')::boolean, true, 'envelope novo é recebido (criado=true)');
select is((:'recibo_criacao'::jsonb->>'estado'), 'pendente', 'envelope novo nasce pendente');

select is(
  ((pcm.sso_receber_envelope_origem_campo('auvo', 1750011, 'evt-recebida-1', '1750001', '2026-11-10T10:00:00Z', '{"evento":"criada"}'::jsonb))->>'criado')::boolean,
  false, 'reentrega idêntica do mesmo evento não duplica (criado=false)'
);
select is(
  ((pcm.sso_receber_envelope_origem_campo('auvo', 1750011, 'evt-recebida-1', '1750001', '2026-11-10T10:00:00Z', '{"evento":"criada"}'::jsonb))->>'envelopeId'),
  (:'recibo_criacao'::jsonb->>'envelopeId'), 'reentrega idêntica devolve o mesmo envelopeId'
);

select throws_ok(
  $$ select pcm.sso_receber_envelope_origem_campo('auvo', 1750011, 'evt-recebida-1', '1750001', '2026-11-10T10:00:00Z', '{"evento":"divergente"}'::jsonb) $$,
  '23505', 'evento_conflitante', 'mesma chave de evento com payload divergente é recusada, nunca sobrescrita'
);

reset role;
set local request.jwt.claims = '{"sub":"17500000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  $$ select pcm.sso_resolver_envelope_origem_idempotente((select (pcm.sso_receber_envelope_origem_campo('auvo', 1750011, 'evt-recebida-1', '1750001', '2026-11-10T10:00:00Z', '{"evento":"criada"}'::jsonb))->>'envelopeId')::uuid) $$,
  '42501', null, 'authenticated não tem execute grant de resolver envelope, só service_role (migration 1419)'
);

set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select (pcm.sso_resolver_envelope_origem_idempotente((:'recibo_criacao'::jsonb->>'envelopeId')::uuid)) as resolucao_1 \gset
select is(:'resolucao_1'::jsonb->>'resultado', 'os_identificada', 'cliente e OS corretos resolvem os_identificada');
select is(:'resolucao_1'::jsonb->>'clienteId', '17500000-0000-4000-8000-000000000002', 'clienteId resolvido é o dono real da OS');
select is(:'resolucao_1'::jsonb->>'osId', '17500000-0000-4000-8000-000000000004', 'osId resolvido é a OS certa');
select is((:'resolucao_1'::jsonb->>'reutilizada')::boolean, false, 'primeira resolução não é reaproveitada');

select (pcm.sso_resolver_envelope_origem_idempotente((:'recibo_criacao'::jsonb->>'envelopeId')::uuid)) as resolucao_2 \gset
select is((:'resolucao_2'::jsonb->>'reutilizada')::boolean, true, 'replay com estado inalterado reaproveita a resolução (dedup webhook+polling)');
select is(:'resolucao_2'::jsonb->>'resolucaoId', :'resolucao_1'::jsonb->>'resolucaoId', 'replay devolve o mesmo resolucaoId, não cria um novo');

reset role;
select is(
  (select count(*)::int from pcm.origem_campo_resolucoes where envelope_id = (:'recibo_criacao'::jsonb->>'envelopeId')::uuid),
  1, 'replay idempotente não insere segunda linha de histórico'
);
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select (pcm.sso_receber_envelope_origem_campo('auvo', 1750011, 'evt-cliente-desconhecido', '9999999', now(), '{}'::jsonb)) as recibo_desconhecido \gset
select is(
  (pcm.sso_resolver_envelope_origem_idempotente((:'recibo_desconhecido'::jsonb->>'envelopeId')::uuid))->>'resultado',
  'cliente_desconhecido', 'cliente_externo_id sem Cliente correspondente resolve cliente_desconhecido'
);

select (pcm.sso_receber_envelope_origem_campo('auvo', 1750099, 'evt-os-nao-encontrada', '1750001', now(), '{}'::jsonb)) as recibo_sem_os \gset
select is(
  (pcm.sso_resolver_envelope_origem_idempotente((:'recibo_sem_os'::jsonb->>'envelopeId')::uuid))->>'resultado',
  'os_nao_encontrada', 'task_id sem OS correspondente resolve os_nao_encontrada'
);

select (pcm.sso_receber_envelope_origem_campo('auvo', 1750011, 'evt-cliente-divergente', '1750002', now(), '{}'::jsonb)) as recibo_divergente \gset
select is(
  (pcm.sso_resolver_envelope_origem_idempotente((:'recibo_divergente'::jsonb->>'envelopeId')::uuid))->>'resultado',
  'cliente_divergente', 'OS existe mas pertence a outro Cliente resolve cliente_divergente, nunca vincula'
);

select * from finish();
rollback;
