-- E01-S175 AC-1/AC-2/AC-5 (processar tarefa de campo de forma atômica, migration 1420) — prova
-- real do núcleo que decide entre OS já existente, adoção de OS externa por referência, ou
-- criação provisória (liberada pela migration 1842, que concluiu a transição 1:1 -> 1:N; antes
-- dela o caminho recusava com `transicao_legada_incompleta`).
-- Idempotência real por (integracao,task_id): reentrega nunca
-- duplica Chamado/OS. Continuação do fechamento de S175 (gap de 38 migrations quase sem pgTAP).
begin;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('17500000-0000-4000-8000-000000000101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's175-processamento@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('17500000-0000-4000-8000-000000000101', 'superadmin', 'S175 Processamento', true);
insert into pcm.clientes (id, nome, ativo, auvo_id, created_by) values
 ('17500000-0000-4000-8000-000000000102', 'Cliente S175 Processamento', true, 1750101, '17500000-0000-4000-8000-000000000101');
-- `definicao` mapeia campos lógicos pro payload cru 1:1 (mesmos nomes) pra simplificar a prova —
-- `sso_conferir_projecao_origem` (1422) exige que a projeção bata exatamente com o payload bruto
-- guardado na inbox através desse mapeamento, campo a campo, incluindo fuso de data/hora.
insert into pcm.sso_contratos_origem_campo (id, integracao, versao, habilitado, definicao) values
 ('17500000-0000-4000-8000-000000000103', 'auvo', 'v1', true, '{
   "campos": {"taskId":"taskId","clienteId":"clienteId","titulo":"titulo","status":"status","ordem":"ordem",
     "descricao":"descricao","osExternaId":"osExternaId","chamadoId":"chamadoId","tecnicoId":"tecnicoId",
     "dataAgendada":"dataAgendada","checkIn":"checkIn","checkOut":"checkOut","detalhes":"detalhes"},
   "estados": {"aberta":"aberta","em_andamento":"em_andamento","concluida":"concluida"},
   "fuso": "America/Sao_Paulo"
 }'::jsonb);

-- Chamado+OS já existente com a task do Auvo já vinculada (caminho "os_existente").
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('17500000-0000-4000-8000-000000000104', 'CH-S175-PROC-A', '17500000-0000-4000-8000-000000000102', 'Chamado com OS já vinculada', '17500000-0000-4000-8000-000000000101');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, auvo_task_id, created_by) values
 ('17500000-0000-4000-8000-000000000105', '17500000-0000-4000-8000-000000000102', '17500000-0000-4000-8000-000000000104', 'OS-S175-PROC-A', 'OS já vinculada', 'corretiva', 'em_execucao', 1750201, '17500000-0000-4000-8000-000000000101');

-- Chamado+OS existente SEM task do Auvo ainda — alvo do caminho "os_externa_identificada".
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('17500000-0000-4000-8000-000000000106', 'CH-S175-PROC-B', '17500000-0000-4000-8000-000000000102', 'Chamado aguardando identificação externa', '17500000-0000-4000-8000-000000000101');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, created_by) values
 ('17500000-0000-4000-8000-000000000107', '17500000-0000-4000-8000-000000000102', '17500000-0000-4000-8000-000000000106', 'OS-S175-PROC-B', 'OS aguardando identificação', 'corretiva', 'solicitacao', '17500000-0000-4000-8000-000000000101');

update pcm.origem_campo_inbox_gate set habilitado = true where id;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select (pcm.sso_receber_envelope_origem_campo('auvo', 1750201, 'evt-proc-os-existente', '1750101', now(),
  '{"taskId":"1750201","clienteId":"1750101","titulo":"Atualização de campo","status":"em_andamento","ordem":"1"}'::jsonb)) as recibo_existente \gset

select throws_ok(
  format($f$ select pcm.sso_processar_tarefa_campo_atomica((%L::jsonb->>'envelopeId')::uuid,%L,'{"titulo":"t","statusCampo":"aberta","referenciaInvalida":false,"ordemExterna":"1"}'::jsonb) $f$,
    :'recibo_existente', '17500000-0000-4000-8000-000000000103'),
  '55000', 'processamento_desabilitado', 'gate de processamento fechado por padrão recusa'
);

reset role;
update pcm.sso_processamento_origem_gate set habilitado = true where id;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select throws_ok(
  format($f$ select pcm.sso_processar_tarefa_campo_atomica((%L::jsonb->>'envelopeId')::uuid,gen_random_uuid(),'{"titulo":"t","statusCampo":"aberta","referenciaInvalida":false,"ordemExterna":"1"}'::jsonb) $f$,
    :'recibo_existente'),
  '55000', 'contrato_nao_habilitado', 'contrato de integração inexistente/desabilitado é recusado'
);

select throws_ok(
  format($f$ select pcm.sso_processar_tarefa_campo_atomica(gen_random_uuid(),%L,'{"titulo":"t","statusCampo":"aberta","referenciaInvalida":false,"ordemExterna":"1"}'::jsonb) $f$,
    '17500000-0000-4000-8000-000000000103'),
  '22023', 'envelope_indisponivel', 'envelope inexistente é recusado'
);

select throws_ok(
  format($f$ select pcm.sso_processar_tarefa_campo_atomica((%L::jsonb->>'envelopeId')::uuid,%L,'{"titulo":"t","statusCampo":"aberta","ordemExterna":"1"}'::jsonb) $f$,
    :'recibo_existente', '17500000-0000-4000-8000-000000000103'),
  '22023', 'parametros_invalidos', 'referenciaInvalida ausente (não é booleano) é recusado'
);

select throws_ok(
  format($f$ select pcm.sso_processar_tarefa_campo_atomica((%L::jsonb->>'envelopeId')::uuid,%L,'{"titulo":"t","statusCampo":"aberta","referenciaInvalida":false}'::jsonb) $f$,
    :'recibo_existente', '17500000-0000-4000-8000-000000000103'),
  '22023', 'parametros_invalidos', 'ordemExterna ausente é recusado'
);

select (pcm.sso_receber_envelope_origem_campo('auvo', 1750202, 'evt-proc-cliente-desconhecido', '999999999', now(), '{}'::jsonb)) as recibo_sem_cliente \gset
select (pcm.sso_processar_tarefa_campo_atomica((:'recibo_sem_cliente'::jsonb->>'envelopeId')::uuid, '17500000-0000-4000-8000-000000000103',
  '{"titulo":"t","statusCampo":"aberta","referenciaInvalida":false,"ordemExterna":"1"}'::jsonb)) as resultado_sem_cliente \gset
select is(:'resultado_sem_cliente'::jsonb->>'motivo', 'cliente_nao_resolvido', 'cliente_externo_id sem correspondência única fica pendente, não processa às cegas');

select (pcm.sso_processar_tarefa_campo_atomica((:'recibo_existente'::jsonb->>'envelopeId')::uuid, '17500000-0000-4000-8000-000000000103',
  '{"titulo":"Atualização de campo","statusCampo":"em_andamento","referenciaInvalida":false,"ordemExterna":"1"}'::jsonb)) as resultado_existente \gset
select is(:'resultado_existente'::jsonb->>'motivo', 'os_existente', 'task_id já vinculado a uma OS real processa pelo caminho os_existente');
select is(:'resultado_existente'::jsonb->>'osId', '17500000-0000-4000-8000-000000000105', 'processamento aponta pra OS certa, nunca cria uma nova');

select (pcm.sso_receber_envelope_origem_campo('auvo', 1750201, 'evt-proc-os-existente-replay', '1750101', now(), '{}'::jsonb)) as recibo_replay \gset
select is(
  (pcm.sso_processar_tarefa_campo_atomica((:'recibo_replay'::jsonb->>'envelopeId')::uuid, '17500000-0000-4000-8000-000000000103',
    '{"titulo":"t","statusCampo":"aberta","referenciaInvalida":false,"ordemExterna":"1"}'::jsonb))->>'reutilizado',
  'true', 'reentrega da mesma task_id (envelope diferente) reaproveita o resultado, nunca duplica Chamado/OS'
);

select (pcm.sso_receber_envelope_origem_campo('auvo', 1750203, 'evt-proc-os-externa', '1750101', now(),
  '{"taskId":"1750203","clienteId":"1750101","titulo":"t","status":"aberta","ordem":"1","osExternaId":"17500000-0000-4000-8000-000000000107"}'::jsonb)) as recibo_externa \gset
select (pcm.sso_processar_tarefa_campo_atomica((:'recibo_externa'::jsonb->>'envelopeId')::uuid, '17500000-0000-4000-8000-000000000103',
  '{"titulo":"t","statusCampo":"aberta","referenciaInvalida":false,"ordemExterna":"1","osExternaId":"17500000-0000-4000-8000-000000000107"}'::jsonb)) as resultado_externa \gset
select is(:'resultado_externa'::jsonb->>'motivo', 'os_externa_identificada', 'osExternaId aponta pra OS real sem task ainda vincula (adoção), não cria OS nova');

reset role;
select is(
  (select auvo_task_id from pcm.ordens_servico where id = '17500000-0000-4000-8000-000000000107'),
  1750203::bigint, 'OS adotada por referência externa recebe o task_id de verdade'
);

set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

-- Criação provisória: sem referência e sem OS existente, o núcleo cria Chamado+OS do zero.
-- Até a migration 1842 este caminho recusava com `55000 transicao_legada_incompleta` — ele checa
-- explicitamente se `pcm.uq_ordens_servico_chamado` ou `trg_ordens_servico_numero_chamado` ainda
-- existem. O corte removeu os dois, então o caminho ficou alcançável e passou a ser provável aqui.
select (pcm.sso_receber_envelope_origem_campo('auvo', 1750999, 'evt-proc-provisorio', '1750101', now(),
  '{"taskId":"1750999","clienteId":"1750101","titulo":"Tarefa sem referência","status":"aberta","ordem":"9"}'::jsonb)) as recibo_provisorio \gset
select (pcm.sso_processar_tarefa_campo_atomica((:'recibo_provisorio'::jsonb->>'envelopeId')::uuid, '17500000-0000-4000-8000-000000000103',
  '{"titulo":"Tarefa sem referência","statusCampo":"aberta","referenciaInvalida":false,"ordemExterna":"9"}'::jsonb)) as resultado_provisorio \gset
select is(
  :'resultado_provisorio'::jsonb->>'motivo', 'referencia_ausente',
  'sem referência e sem OS existente, o corte 1:N liberou a criação provisória de Chamado+OS'
);

reset role;
set local request.jwt.claims = '{"sub":"17500000-0000-4000-8000-000000000101","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select pcm.sso_processar_tarefa_campo_atomica((%L::jsonb->>'envelopeId')::uuid,%L,'{"titulo":"t","statusCampo":"aberta","referenciaInvalida":false,"ordemExterna":"1"}'::jsonb) $f$,
    :'recibo_existente', '17500000-0000-4000-8000-000000000103'),
  '42501', null, 'authenticated não tem execute grant nessa função, só service_role (migration 1426)'
);

reset role;
select throws_ok(
  $$ update pcm.sso_origem_campo_processamentos set motivo = 'editado' where true $$,
  '23514', null, 'histórico de processamento é append-only, nunca editado'
);

select * from finish();
rollback;
