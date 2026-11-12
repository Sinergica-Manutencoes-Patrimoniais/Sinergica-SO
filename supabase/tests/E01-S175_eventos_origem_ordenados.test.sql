-- E01-S175 (eventos de origem de campo ordenados por ordemExterna, migration 1424) — prova real
-- de `pcm.sso_registrar_evento_origem`: aceita em ordem, marca atrasado quando a ordem já foi
-- superada, marca conflito_regressao quando o status civil regride (concluida->outra,
-- em_andamento->aberta), reaproveita replay idêntico e recusa replay de mesma ordem com conteúdo
-- divergente. Gap era só de teste: código e grant (service_role, migration 1426) já eram reais.
begin;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('17510000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's175-eventos@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('17510000-0000-4000-8000-000000000001', 'superadmin', 'S175 Eventos', true);
insert into pcm.clientes (id, nome, ativo, auvo_id, created_by) values
 ('17510000-0000-4000-8000-000000000002', 'Cliente S175 Eventos', true, 1751101, '17510000-0000-4000-8000-000000000001');
insert into pcm.sso_contratos_origem_campo (id, integracao, versao, habilitado, definicao) values
 ('17510000-0000-4000-8000-000000000003', 'auvo', 'v1', true, '{
   "campos": {"taskId":"taskId","clienteId":"clienteId","titulo":"titulo","status":"status","ordem":"ordem",
     "descricao":"descricao","osExternaId":"osExternaId","chamadoId":"chamadoId","tecnicoId":"tecnicoId",
     "dataAgendada":"dataAgendada","checkIn":"checkIn","checkOut":"checkOut","detalhes":"detalhes"},
   "estados": {"aberta":"aberta","em_andamento":"em_andamento","concluida":"concluida"},
   "fuso": "America/Sao_Paulo"
 }'::jsonb);
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('17510000-0000-4000-8000-000000000004', 'CH-S175-EVT', '17510000-0000-4000-8000-000000000002', 'Chamado eventos ordenados', '17510000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, auvo_task_id, created_by) values
 ('17510000-0000-4000-8000-000000000005', '17510000-0000-4000-8000-000000000002', '17510000-0000-4000-8000-000000000004', 'OS-S175-EVT', 'OS com task já vinculada', 'corretiva', 'em_execucao', 1751201, '17510000-0000-4000-8000-000000000001');

update pcm.origem_campo_inbox_gate set habilitado = true where id;
update pcm.sso_processamento_origem_gate set habilitado = true where id;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

-- Evento base (ordem 5, aberta): processar_tarefa_campo_atomica cria o processamento e o
-- trigger sso_registrar_primeiro_evento_origem insere o primeiro evento (sempre 'aceito').
select (pcm.sso_receber_envelope_origem_campo('auvo', 1751201, 'evt-s175-base', '1751101', now(),
  '{"taskId":"1751201","clienteId":"1751101","titulo":"Evento base","status":"aberta","ordem":"5"}'::jsonb)) as recibo_base \gset
select (pcm.sso_processar_tarefa_campo_atomica((:'recibo_base'::jsonb->>'envelopeId')::uuid, '17510000-0000-4000-8000-000000000003',
  '{"titulo":"Evento base","statusCampo":"aberta","referenciaInvalida":false,"ordemExterna":"5"}'::jsonb)) as resultado_base \gset

-- Envelope órfão: recebido mas nunca processado por sso_processar_tarefa_campo_atomica.
select (pcm.sso_receber_envelope_origem_campo('auvo', 1751299, 'evt-s175-orfao', '1751101', now(), '{}'::jsonb)) as recibo_orfao \gset

reset role;
update pcm.sso_processamento_origem_gate set habilitado = false where id;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
select throws_ok(
  format($f$ select pcm.sso_registrar_evento_origem((%L::jsonb->>'envelopeId')::uuid,%L,'{"titulo":"x","statusCampo":"aberta","ordemExterna":"6"}'::jsonb) $f$,
    :'recibo_base', '17510000-0000-4000-8000-000000000003'),
  '55000', 'processamento_desabilitado', 'gate de processamento fechado recusa registrar evento'
);

reset role;
update pcm.sso_processamento_origem_gate set habilitado = true where id;
update pcm.origem_campo_inbox_gate set habilitado = false where id;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
select throws_ok(
  format($f$ select pcm.sso_registrar_evento_origem((%L::jsonb->>'envelopeId')::uuid,%L,'{"titulo":"x","statusCampo":"aberta","ordemExterna":"6"}'::jsonb) $f$,
    :'recibo_base', '17510000-0000-4000-8000-000000000003'),
  '55000', 'inbox_desabilitada', 'gate de inbox fechado recusa registrar evento'
);

reset role;
update pcm.origem_campo_inbox_gate set habilitado = true where id;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select throws_ok(
  format($f$ select pcm.sso_registrar_evento_origem((%L::jsonb->>'envelopeId')::uuid,%L,'{"titulo":"x","statusCampo":"aberta","ordemExterna":"0"}'::jsonb) $f$,
    :'recibo_base', '17510000-0000-4000-8000-000000000003'),
  '22023', 'parametros_invalidos', 'ordemExterna com zero/formato inválido é recusada'
);

select throws_ok(
  format($f$ select pcm.sso_registrar_evento_origem((%L::jsonb->>'envelopeId')::uuid,%L,'{"titulo":"x","statusCampo":"pausada","ordemExterna":"6"}'::jsonb) $f$,
    :'recibo_base', '17510000-0000-4000-8000-000000000003'),
  '22023', 'parametros_invalidos', 'statusCampo fora do enum é recusado'
);

select throws_ok(
  format($f$ select pcm.sso_registrar_evento_origem(gen_random_uuid(),%L,'{"titulo":"x","statusCampo":"aberta","ordemExterna":"6"}'::jsonb) $f$,
    '17510000-0000-4000-8000-000000000003'),
  '22023', 'envelope_indisponivel', 'envelope inexistente é recusado'
);

select throws_ok(
  format($f$ select pcm.sso_registrar_evento_origem((%L::jsonb->>'envelopeId')::uuid,%L,'{"titulo":"x","statusCampo":"aberta","ordemExterna":"6"}'::jsonb) $f$,
    :'recibo_orfao', '17510000-0000-4000-8000-000000000003'),
  '23514', 'processamento_inicial_ausente', 'envelope sem processamento inicial nunca registra evento solto'
);

-- Atrasado: ordem 3 chega depois da base (ordem 5) já aceita.
select (pcm.sso_receber_envelope_origem_campo('auvo', 1751201, 'evt-s175-atrasado', '1751101', now(),
  '{"taskId":"1751201","clienteId":"1751101","titulo":"Atrasado","status":"aberta","ordem":"3"}'::jsonb)) as recibo_atrasado \gset
select (pcm.sso_registrar_evento_origem((:'recibo_atrasado'::jsonb->>'envelopeId')::uuid, '17510000-0000-4000-8000-000000000003',
  '{"titulo":"Atrasado","statusCampo":"aberta","referenciaInvalida":false,"ordemExterna":"3"}'::jsonb)) as resultado_atrasado \gset
select is(:'resultado_atrasado'::jsonb->>'estado', 'atrasado', 'ordem menor que a última aceita é marcada atrasado, nunca rejeitada');

-- Aceito em ordem (ordem 7, em_andamento).
select (pcm.sso_receber_envelope_origem_campo('auvo', 1751201, 'evt-s175-aceito-7', '1751101', now(),
  '{"taskId":"1751201","clienteId":"1751101","titulo":"Em andamento","status":"em_andamento","ordem":"7"}'::jsonb)) as recibo_aceito7 \gset
select (pcm.sso_registrar_evento_origem((:'recibo_aceito7'::jsonb->>'envelopeId')::uuid, '17510000-0000-4000-8000-000000000003',
  '{"titulo":"Em andamento","statusCampo":"em_andamento","referenciaInvalida":false,"ordemExterna":"7"}'::jsonb)) as resultado_aceito7 \gset
select is(:'resultado_aceito7'::jsonb->>'estado', 'aceito', 'ordem maior em sequência normal é aceita');

-- Replay idêntico da ordem 7 (envelope novo, mesma ordem/conteúdo): reaproveita, nunca duplica.
select (pcm.sso_receber_envelope_origem_campo('auvo', 1751201, 'evt-s175-aceito-7-replay', '1751101', now(),
  '{"taskId":"1751201","clienteId":"1751101","titulo":"Em andamento","status":"em_andamento","ordem":"7"}'::jsonb)) as recibo_replay7 \gset
select (pcm.sso_registrar_evento_origem((:'recibo_replay7'::jsonb->>'envelopeId')::uuid, '17510000-0000-4000-8000-000000000003',
  '{"titulo":"Em andamento","statusCampo":"em_andamento","referenciaInvalida":false,"ordemExterna":"7"}'::jsonb)) as resultado_replay7 \gset
select is(:'resultado_replay7'::jsonb->>'reutilizado', 'true', 'replay com mesmo conteúdo na mesma ordem reaproveita, não insere evento novo');

-- Replay da ordem 7 com conteúdo divergente: conflito, nunca aplica às cegas.
select (pcm.sso_receber_envelope_origem_campo('auvo', 1751201, 'evt-s175-conflito-7', '1751101', now(),
  '{"taskId":"1751201","clienteId":"1751101","titulo":"Divergente","status":"concluida","ordem":"7"}'::jsonb)) as recibo_conflito7 \gset
select (pcm.sso_registrar_evento_origem((:'recibo_conflito7'::jsonb->>'envelopeId')::uuid, '17510000-0000-4000-8000-000000000003',
  '{"titulo":"Divergente","statusCampo":"concluida","referenciaInvalida":false,"ordemExterna":"7"}'::jsonb)) as resultado_conflito7 \gset
select is(:'resultado_conflito7'::jsonb->>'motivo', 'mesma_ordem_conteudo_divergente', 'mesma ordem com conteúdo diferente nunca substitui o evento já aceito');

-- Aceito ordem 9, concluida (prepara a regressão seguinte).
select (pcm.sso_receber_envelope_origem_campo('auvo', 1751201, 'evt-s175-aceito-9', '1751101', now(),
  '{"taskId":"1751201","clienteId":"1751101","titulo":"Concluída","status":"concluida","ordem":"9"}'::jsonb)) as recibo_aceito9 \gset
select (pcm.sso_registrar_evento_origem((:'recibo_aceito9'::jsonb->>'envelopeId')::uuid, '17510000-0000-4000-8000-000000000003',
  '{"titulo":"Concluída","statusCampo":"concluida","referenciaInvalida":false,"ordemExterna":"9"}'::jsonb)) as resultado_aceito9 \gset
select is(:'resultado_aceito9'::jsonb->>'estado', 'aceito', 'conclusão em sequência normal é aceita');

-- Regressão: ordem 11 volta pra aberta depois de concluida — conflito_regressao, nunca reabre às cegas.
select (pcm.sso_receber_envelope_origem_campo('auvo', 1751201, 'evt-s175-regressao-11', '1751101', now(),
  '{"taskId":"1751201","clienteId":"1751101","titulo":"Reaberta","status":"aberta","ordem":"11"}'::jsonb)) as recibo_regressao \gset
select (pcm.sso_registrar_evento_origem((:'recibo_regressao'::jsonb->>'envelopeId')::uuid, '17510000-0000-4000-8000-000000000003',
  '{"titulo":"Reaberta","statusCampo":"aberta","referenciaInvalida":false,"ordemExterna":"11"}'::jsonb)) as resultado_regressao \gset
select is(:'resultado_regressao'::jsonb->>'estado', 'conflito_regressao', 'reabrir depois de concluída é marcado conflito_regressao, nunca aceito direto');

reset role;
select is(
  (select estado from pcm.sso_origem_campo_eventos where integracao = 'auvo' and task_id = 1751201 and ordem_externa = 3),
  'atrasado', 'estado atrasado fica persistido no histórico de eventos'
);
select is(
  (select estado from pcm.sso_origem_campo_eventos where integracao = 'auvo' and task_id = 1751201 and ordem_externa = 11),
  'conflito_regressao', 'estado conflito_regressao fica persistido no histórico de eventos'
);

set local request.jwt.claims = '{"sub":"17510000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  format($f$ select pcm.sso_registrar_evento_origem((%L::jsonb->>'envelopeId')::uuid,%L,'{"titulo":"x","statusCampo":"aberta","ordemExterna":"13"}'::jsonb) $f$,
    :'recibo_base', '17510000-0000-4000-8000-000000000003'),
  '42501', null, 'authenticated não tem execute grant nessa função, só service_role (migration 1426)'
);

reset role;
select throws_ok(
  $$ update pcm.sso_origem_campo_eventos set estado = 'aceito' where true $$,
  '23514', null, 'histórico de eventos de origem é append-only, nunca editado'
);

select * from finish();
rollback;
