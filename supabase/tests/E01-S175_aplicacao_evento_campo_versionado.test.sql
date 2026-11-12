-- E01-S175 (aplicar evento de campo versionado + conferência PCM, migrations 1609/1610/1613) —
-- primeira prova real de ponta a ponta de todo o cluster. Cobre: aplicação automática
-- (service_role) quando a OS nasceu com fotografia (`aplicacao_automatica=true`), bloqueio por
-- revisão divergente (edição concorrente da OS fora do fluxo de origem de campo), bloqueio total
-- pra OS pré-existente (`aplicacao_automatica=false`, migration 1613) e o desvio explícito via
-- conferência PCM (`sso_previa_conferencia_evento_campo`/`sso_confirmar_evento_campo_pcm`, 1610) —
-- a única porta de entrada autenticada, nunca automática. Zero pgTAP existia pra este cluster.
begin;
select plan(21);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('17520000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's175-aplicar-evento@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('17520000-0000-4000-8000-000000000001', 'superadmin', 'S175 Aplicar Evento', true);
insert into pcm.clientes (id, nome, ativo, auvo_id, created_by) values
 ('17520000-0000-4000-8000-000000000002', 'Cliente S175 Aplicar Evento', true, 1752101, '17520000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('17520000-0000-4000-8000-000000000001', 'execucao.validar', '17520000-0000-4000-8000-000000000002');
insert into pcm.sso_contratos_origem_campo (id, integracao, versao, habilitado, definicao) values
 ('17520000-0000-4000-8000-000000000003', 'auvo', 'v1', true, '{
   "campos": {"taskId":"taskId","clienteId":"clienteId","titulo":"titulo","status":"status","ordem":"ordem",
     "descricao":"descricao","osExternaId":"osExternaId","chamadoId":"chamadoId","tecnicoId":"tecnicoId",
     "dataAgendada":"dataAgendada","checkIn":"checkIn","checkOut":"checkOut","detalhes":"detalhes"},
   "estados": {"aberta":"aberta","em_andamento":"em_andamento","concluida":"concluida"},
   "fuso": "America/Sao_Paulo"
 }'::jsonb);
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('17520000-0000-4000-8000-000000000004', 'CH-S175-APL-A', '17520000-0000-4000-8000-000000000002', 'Chamado fotografia automática', '17520000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, auvo_task_id, created_by) values
 ('17520000-0000-4000-8000-000000000005', '17520000-0000-4000-8000-000000000002', '17520000-0000-4000-8000-000000000004', 'OS-S175-APL-A', 'OS com fotografia automática', 'corretiva', 'solicitacao', 1752201, '17520000-0000-4000-8000-000000000001');
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('17520000-0000-4000-8000-000000000006', 'CH-S175-APL-B', '17520000-0000-4000-8000-000000000002', 'Chamado OS pré-existente', '17520000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, auvo_task_id, created_by) values
 ('17520000-0000-4000-8000-000000000007', '17520000-0000-4000-8000-000000000002', '17520000-0000-4000-8000-000000000006', 'OS-S175-APL-B', 'OS pré-existente, sem aplicação automática', 'corretiva', 'em_execucao', 1752202, '17520000-0000-4000-8000-000000000001');

update pcm.origem_campo_inbox_gate set habilitado = true where id;
update pcm.sso_processamento_origem_gate set habilitado = true where id;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select throws_ok(
  $$ select pcm.sso_aplicar_evento_origem_campo(gen_random_uuid(), 1) $$,
  '55000', 'aplicacao_desabilitada', 'gate de aplicação de evento fechado por padrão recusa'
);

reset role;
update pcm.sso_aplicacao_evento_campo_gate set habilitado = true where id;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

-- Fixture A: processamento com motivo "referencia_chamado" — fotografia nasce com
-- aplicacao_automatica=true (migration 1613), elegível ao caminho automático.
select (pcm.sso_receber_envelope_origem_campo('auvo', 1752201, 'evt-s175-apl-a-1', '1752101', now(),
  '{"taskId":"1752201","clienteId":"1752101","titulo":"Evento A1","status":"aberta","ordem":"1"}'::jsonb)) as recibo_a1 \gset

reset role;
insert into pcm.sso_origem_campo_processamentos(integracao, task_id, envelope_id, contrato_id, cliente_id, chamado_id, os_id, provisorio, motivo, projecao, resultado) values
 ('auvo', 1752201, (:'recibo_a1'::jsonb->>'envelopeId')::uuid, '17520000-0000-4000-8000-000000000003', '17520000-0000-4000-8000-000000000002',
  '17520000-0000-4000-8000-000000000004', '17520000-0000-4000-8000-000000000005', true, 'referencia_chamado',
  '{"titulo":"Evento A1","statusCampo":"aberta","referenciaInvalida":false,"ordemExterna":"1"}'::jsonb, '{}'::jsonb);
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select is(
  (pcm.sso_aplicar_evento_origem_campo((:'recibo_a1'::jsonb->>'envelopeId')::uuid, 1))->>'estado',
  'ja_contemplado', 'reaplicar a ordem da fotografia inicial nunca repete efeito, só confirma'
);

set local request.jwt.claims = '{"sub":"17520000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  format($f$ select pcm.sso_aplicar_evento_origem_campo(%L::uuid, 1) $f$, :'recibo_a1'::jsonb->>'envelopeId'),
  '42501', null, 'authenticated nem chega no corpo da função: sem grant (só service_role), então o desvio por token só é alcançável de dentro de sso_confirmar_evento_campo_pcm'
);

reset role;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select (pcm.sso_receber_envelope_origem_campo('auvo', 1752201, 'evt-s175-apl-a-2', '1752101', now(),
  '{"taskId":"1752201","clienteId":"1752101","titulo":"Evento A2","status":"em_andamento","ordem":"2"}'::jsonb)) as recibo_a2 \gset
select (pcm.sso_registrar_evento_origem((:'recibo_a2'::jsonb->>'envelopeId')::uuid, '17520000-0000-4000-8000-000000000003',
  '{"titulo":"Evento A2","statusCampo":"em_andamento","referenciaInvalida":false,"ordemExterna":"2"}'::jsonb)) as evento_a2 \gset

select (pcm.sso_aplicar_evento_origem_campo((:'recibo_a2'::jsonb->>'envelopeId')::uuid, 2)) as aplicado_a2 \gset
select is(:'aplicado_a2'::jsonb->>'estado', 'aplicado', 'evento em ordem é aplicado automaticamente pelo caminho service_role');
select is(:'aplicado_a2'::jsonb->>'statusAlterado', 'true', 'statusCampo em_andamento numa OS solicitacao move pra em_execucao');
select is(:'aplicado_a2'::jsonb->>'statusOperacional', 'em_execucao', 'statusOperacional reporta a transição real');

reset role;
select is((select status from pcm.ordens_servico where id = '17520000-0000-4000-8000-000000000005'), 'em_execucao', 'a OS realmente transicionou no banco');
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select is(
  (pcm.sso_aplicar_evento_origem_campo((:'recibo_a2'::jsonb->>'envelopeId')::uuid, 2))->>'reutilizado',
  'true', 'reaplicar a mesma ordem já aplicada reaproveita o resultado, nunca duplica'
);
select is(
  (pcm.sso_aplicar_evento_origem_campo((:'recibo_a2'::jsonb->>'envelopeId')::uuid, 99))->>'motivo',
  'evento_nao_aceito', 'ordem nunca aceita no histórico de eventos nunca é aplicada'
);

select (pcm.sso_receber_envelope_origem_campo('auvo', 1752201, 'evt-s175-apl-a-3', '1752101', now(),
  '{"taskId":"1752201","clienteId":"1752101","titulo":"Evento A3","status":"em_andamento","ordem":"3"}'::jsonb)) as recibo_a3 \gset
select (pcm.sso_registrar_evento_origem((:'recibo_a3'::jsonb->>'envelopeId')::uuid, '17520000-0000-4000-8000-000000000003',
  '{"titulo":"Evento A3","statusCampo":"em_andamento","referenciaInvalida":false,"ordemExterna":"3"}'::jsonb)) as evento_a3 \gset
select (pcm.sso_receber_envelope_origem_campo('auvo', 1752201, 'evt-s175-apl-a-4', '1752101', now(),
  '{"taskId":"1752201","clienteId":"1752101","titulo":"Evento A4","status":"concluida","ordem":"4"}'::jsonb)) as recibo_a4 \gset
select (pcm.sso_registrar_evento_origem((:'recibo_a4'::jsonb->>'envelopeId')::uuid, '17520000-0000-4000-8000-000000000003',
  '{"titulo":"Evento A4","statusCampo":"concluida","referenciaInvalida":false,"ordemExterna":"4"}'::jsonb)) as evento_a4 \gset

select is(
  (pcm.sso_aplicar_evento_origem_campo((:'recibo_a3'::jsonb->>'envelopeId')::uuid, 3))->>'motivo',
  'evento_desatualizado', 'ordem 3 chega depois da ordem 4 já aceita, nunca sobrescreve o estado mais novo'
);
select is(
  (pcm.sso_aplicar_evento_origem_campo((:'recibo_a4'::jsonb->>'envelopeId')::uuid, 4))->>'estado',
  'aplicado', 'ordem 4, a mais recente aceita, é aplicada normalmente'
);

reset role;
update pcm.ordens_servico set titulo = 'Editado por outro caminho, fora da origem de campo' where id = '17520000-0000-4000-8000-000000000005';
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select (pcm.sso_receber_envelope_origem_campo('auvo', 1752201, 'evt-s175-apl-a-5', '1752101', now(),
  '{"taskId":"1752201","clienteId":"1752101","titulo":"Evento A5","status":"concluida","ordem":"5"}'::jsonb)) as recibo_a5 \gset
select (pcm.sso_registrar_evento_origem((:'recibo_a5'::jsonb->>'envelopeId')::uuid, '17520000-0000-4000-8000-000000000003',
  '{"titulo":"Evento A5","statusCampo":"concluida","referenciaInvalida":false,"ordemExterna":"5"}'::jsonb)) as evento_a5 \gset
select is(
  (pcm.sso_aplicar_evento_origem_campo((:'recibo_a5'::jsonb->>'envelopeId')::uuid, 5))->>'motivo',
  'os_alterada_exige_conferencia', 'OS editada por outro caminho concorrente nunca recebe o próximo evento às cegas'
);

reset role;
set local request.jwt.claims = '{"sub":"17520000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  format($f$ select pcm.sso_previa_conferencia_evento_campo(%L,%L,%L) $f$,
    '17520000-0000-4000-8000-000000000001', '17520000-0000-4000-8000-000000000002', '17520000-0000-4000-8000-000000000005'),
  '55000', 'conferencia_desabilitada', 'gate de conferência PCM fechado por padrão recusa'
);

reset role;
update pcm.sso_conferencia_evento_campo_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"17520000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select (pcm.sso_previa_conferencia_evento_campo('17520000-0000-4000-8000-000000000001', '17520000-0000-4000-8000-000000000002', '17520000-0000-4000-8000-000000000005')) as previa_a \gset
select is(:'previa_a'::jsonb->>'aplicavel', 'true', 'prévia confirma que há evento mais novo aplicável, pendente de conferência');

select (pcm.sso_confirmar_evento_campo_pcm('17520000-0000-4000-8000-000000000001', '17520000-0000-4000-8000-0000000000f1',
  '17520000-0000-4000-8000-000000000002', '17520000-0000-4000-8000-000000000005', (:'recibo_a5'::jsonb->>'envelopeId')::uuid, 5,
  (:'previa_a'::jsonb->>'revisao')::bigint, null, 'Conferido manualmente pelo PCM')) as confirmado_a \gset
select is(:'confirmado_a'::jsonb->>'requestId', '17520000-0000-4000-8000-0000000000f1', 'conferência PCM aplica o evento mesmo com a OS alterada por fora');

reset role;
select is(
  (select revisao = revisao_aplicada from pcm.sso_versoes_os_origem_campo where os_id = '17520000-0000-4000-8000-000000000005'),
  true, 'depois da conferência, a fotografia fica sincronizada de novo'
);
set local request.jwt.claims = '{"sub":"17520000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select is(
  (pcm.sso_confirmar_evento_campo_pcm('17520000-0000-4000-8000-000000000001', '17520000-0000-4000-8000-0000000000f1',
    '17520000-0000-4000-8000-000000000002', '17520000-0000-4000-8000-000000000005', (:'recibo_a5'::jsonb->>'envelopeId')::uuid, 5,
    (:'previa_a'::jsonb->>'revisao')::bigint, null, 'Conferido manualmente pelo PCM'))->>'requestId',
  '17520000-0000-4000-8000-0000000000f1', 'replay do mesmo requestId de conferência reaproveita, nunca reaplica'
);

-- Fixture B: processamento com motivo "os_existente" — fotografia nasce com
-- aplicacao_automatica=false (migration 1613): OS pré-existente nunca recebe aplicação automática.
reset role;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
select (pcm.sso_receber_envelope_origem_campo('auvo', 1752202, 'evt-s175-apl-b-1', '1752101', now(),
  '{"taskId":"1752202","clienteId":"1752101","titulo":"Evento B1","status":"aberta","ordem":"1"}'::jsonb)) as recibo_b1 \gset

reset role;
insert into pcm.sso_origem_campo_processamentos(integracao, task_id, envelope_id, contrato_id, cliente_id, chamado_id, os_id, provisorio, motivo, projecao, resultado) values
 ('auvo', 1752202, (:'recibo_b1'::jsonb->>'envelopeId')::uuid, '17520000-0000-4000-8000-000000000003', '17520000-0000-4000-8000-000000000002',
  '17520000-0000-4000-8000-000000000006', '17520000-0000-4000-8000-000000000007', false, 'os_existente',
  '{"titulo":"Evento B1","statusCampo":"aberta","referenciaInvalida":false,"ordemExterna":"1"}'::jsonb, '{}'::jsonb);
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select (pcm.sso_receber_envelope_origem_campo('auvo', 1752202, 'evt-s175-apl-b-2', '1752101', now(),
  '{"taskId":"1752202","clienteId":"1752101","titulo":"Evento B2","status":"em_andamento","ordem":"2"}'::jsonb)) as recibo_b2 \gset
select (pcm.sso_registrar_evento_origem((:'recibo_b2'::jsonb->>'envelopeId')::uuid, '17520000-0000-4000-8000-000000000003',
  '{"titulo":"Evento B2","statusCampo":"em_andamento","referenciaInvalida":false,"ordemExterna":"2"}'::jsonb)) as evento_b2 \gset
select is(
  (pcm.sso_aplicar_evento_origem_campo((:'recibo_b2'::jsonb->>'envelopeId')::uuid, 2))->>'motivo',
  'os_preexistente_exige_conferencia', 'OS pré-existente nunca aplica evento automaticamente, sempre exige conferência PCM'
);

reset role;
set local request.jwt.claims = '{"sub":"17520000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select (pcm.sso_previa_conferencia_evento_campo('17520000-0000-4000-8000-000000000001', '17520000-0000-4000-8000-000000000002', '17520000-0000-4000-8000-000000000007')) as previa_b \gset
select is(
  (pcm.sso_confirmar_evento_campo_pcm('17520000-0000-4000-8000-000000000001', '17520000-0000-4000-8000-0000000000f2',
    '17520000-0000-4000-8000-000000000002', '17520000-0000-4000-8000-000000000007', (:'recibo_b2'::jsonb->>'envelopeId')::uuid, 2,
    (:'previa_b'::jsonb->>'revisao')::bigint, null, 'Conferido OS pré-existente pelo PCM'))->>'requestId',
  '17520000-0000-4000-8000-0000000000f2', 'conferência PCM aplica mesmo quando a OS nunca teve aplicação automática'
);

reset role;
select throws_ok(
  $$ update pcm.sso_eventos_campo_aplicados set os_id = gen_random_uuid() where true $$,
  '23514', null, 'histórico de eventos aplicados é append-only, nunca editado'
);
select throws_ok(
  $$ update pcm.sso_conferencias_evento_campo set resultado = '{}'::jsonb where true $$,
  '23514', null, 'histórico de conferências PCM é append-only, nunca editado'
);

select * from finish();
rollback;
