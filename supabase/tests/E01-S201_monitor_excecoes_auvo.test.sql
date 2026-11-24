-- E01-S201 — Monitor consolidado de exceções do Auvo (T−24), BL 004 do Pacote Consolidado
-- ("falha de envio, Visita não confirmada e tarefa órfã" no mesmo lugar).
--
-- A regra que esta prova fixa: as três famílias saem da MESMA consulta, cada uma com o próprio
-- recorte, e o que NÃO é exceção fica de fora — tentativa já confirmada, Visita cuja janela T−24
-- ainda não abriu, Visita confirmada e item de outro Cliente. Prova também que gate fechado e
-- falta de capacidade recusam com erro NOMEADO, nunca com lista vazia.
begin;
select plan(17);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('20100000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's201-pcm@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('20100000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's201-sem-acesso@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('20100000-0000-4000-8000-000000000001', 'superadmin', 'S201 PCM', true),
 ('20100000-0000-4000-8000-000000000002', 'colaborador', 'S201 Sem acesso', true);

insert into pcm.clientes (id, nome, ativo, auvo_id, created_by) values
 ('20100000-0000-4000-8000-000000000010', 'Cliente S201', true, 2010101, '20100000-0000-4000-8000-000000000001'),
 ('20100000-0000-4000-8000-000000000011', 'Cliente S201 vizinho', true, 2010102, '20100000-0000-4000-8000-000000000001');

-- ── Família 1: FALHA DE ENVIO ───────────────────────────────────────────────
-- Visita confirmada, tentativa produzida e parada em 'incerto' (1310) — o planejamento local
-- continua inteiro, que é justamente a regra de BL 004.
insert into pcm.visitas (id, cliente_id, inicio_em, fim_em, fuso, natureza, estado, created_by) values
 ('20100000-0000-4000-8000-000000000020', '20100000-0000-4000-8000-000000000010', now() + interval '2 hours', now() + interval '6 hours', 'America/Sao_Paulo', 'regular', 'confirmada', '20100000-0000-4000-8000-000000000001');
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('20100000-0000-4000-8000-000000000030', 'CH-S201-A', '20100000-0000-4000-8000-000000000010', 'Chamado da OS com falha de envio', '20100000-0000-4000-8000-000000000001'),
 ('20100000-0000-4000-8000-000000000031', 'CH-S201-B', '20100000-0000-4000-8000-000000000010', 'Chamado da OS já confirmada no Auvo', '20100000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, auvo_task_id, created_by) values
 ('20100000-0000-4000-8000-000000000040', '20100000-0000-4000-8000-000000000010', '20100000-0000-4000-8000-000000000030', 'OS-S201-A', 'OS com falha de envio', 'preventiva', 'em_execucao', 777001, '20100000-0000-4000-8000-000000000001'),
 ('20100000-0000-4000-8000-000000000041', '20100000-0000-4000-8000-000000000010', '20100000-0000-4000-8000-000000000031', 'OS-S201-B', 'OS confirmada no Auvo', 'preventiva', 'em_execucao', 777002, '20100000-0000-4000-8000-000000000001');
insert into pcm.auvo_sync_outbox (id, entity, row_id, op, status, attempts, last_error) values
 ('20100000-0000-4000-8000-000000000050', 'ordens_servico_t24', '20100000-0000-4000-8000-000000000040', 'update', 'error', 0, 'HTTP 500 do Auvo');
insert into pcm.sso_t24_tentativas (id, cliente_id, visita_id, os_id, revisao_visita, operacao, tarefa_id, esperado, questionario_obrigatorio, elegivel_em, estado, fence, outbox_id, atualizado_em) values
 ('20100000-0000-4000-8000-000000000060', '20100000-0000-4000-8000-000000000010', '20100000-0000-4000-8000-000000000020', '20100000-0000-4000-8000-000000000040', 1, 'atualizar', '777001', '{}'::jsonb, false, now() - interval '22 hours', 'incerto', 3, '20100000-0000-4000-8000-000000000050', now()),
 -- Negativo: tentativa CONFIRMADA não é exceção — é o caminho feliz.
 ('20100000-0000-4000-8000-000000000061', '20100000-0000-4000-8000-000000000010', '20100000-0000-4000-8000-000000000020', '20100000-0000-4000-8000-000000000041', 1, 'atualizar', '777002', '{}'::jsonb, false, now() - interval '22 hours', 'confirmado', 2, null, now());
-- O último evento por `sequencia` é o motivo que o monitor mostra.
insert into pcm.sso_t24_tentativa_eventos (tentativa_id, sequencia, fence, estado, motivo) values
 ('20100000-0000-4000-8000-000000000060', 1, 0, 'aguardando', 'candidata_preventiva_registrada'),
 ('20100000-0000-4000-8000-000000000060', 2, 3, 'incerto', 'timeout_auvo');

-- ── Família 2: VISITA NÃO CONFIRMADA ────────────────────────────────────────
-- Janela T−24 aberta (início em 2h), Visita ainda 'planejada' e com OS vinculada vigente: o
-- produtor (1325/1330) exige 'confirmada', logo nenhuma tentativa existe — a exceção é a ausência.
insert into pcm.visitas (id, cliente_id, inicio_em, fim_em, fuso, natureza, estado, created_by) values
 ('20100000-0000-4000-8000-000000000021', '20100000-0000-4000-8000-000000000010', now() + interval '2 hours', now() + interval '6 hours', 'America/Sao_Paulo', 'regular', 'planejada', '20100000-0000-4000-8000-000000000001'),
 -- Negativo: janela T−24 ainda NÃO abriu (início daqui a 72h).
 ('20100000-0000-4000-8000-000000000022', '20100000-0000-4000-8000-000000000010', now() + interval '72 hours', now() + interval '76 hours', 'America/Sao_Paulo', 'regular', 'planejada', '20100000-0000-4000-8000-000000000001'),
 -- Negativo: Visita confirmada dentro da janela não é exceção nenhuma.
 ('20100000-0000-4000-8000-000000000023', '20100000-0000-4000-8000-000000000010', now() + interval '3 hours', now() + interval '7 hours', 'America/Sao_Paulo', 'regular', 'confirmada', '20100000-0000-4000-8000-000000000001'),
 -- Isolamento: mesma exceção, outro Cliente.
 ('20100000-0000-4000-8000-000000000024', '20100000-0000-4000-8000-000000000011', now() + interval '2 hours', now() + interval '6 hours', 'America/Sao_Paulo', 'regular', 'planejada', '20100000-0000-4000-8000-000000000001');
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('20100000-0000-4000-8000-000000000032', 'CH-S201-C', '20100000-0000-4000-8000-000000000010', 'Chamado da OS sem tarefa', '20100000-0000-4000-8000-000000000001'),
 ('20100000-0000-4000-8000-000000000033', 'CH-S201-D', '20100000-0000-4000-8000-000000000010', 'Chamado da Visita fora da janela', '20100000-0000-4000-8000-000000000001'),
 ('20100000-0000-4000-8000-000000000034', 'CH-S201-E', '20100000-0000-4000-8000-000000000010', 'Chamado da Visita confirmada', '20100000-0000-4000-8000-000000000001'),
 ('20100000-0000-4000-8000-000000000035', 'CH-S201-F', '20100000-0000-4000-8000-000000000011', 'Chamado do vizinho', '20100000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, created_by) values
 ('20100000-0000-4000-8000-000000000042', '20100000-0000-4000-8000-000000000010', '20100000-0000-4000-8000-000000000032', 'OS-S201-C', 'OS que não virou tarefa', 'preventiva', 'planejamento', '20100000-0000-4000-8000-000000000001'),
 ('20100000-0000-4000-8000-000000000043', '20100000-0000-4000-8000-000000000010', '20100000-0000-4000-8000-000000000033', 'OS-S201-D', 'OS de Visita fora da janela', 'preventiva', 'planejamento', '20100000-0000-4000-8000-000000000001'),
 ('20100000-0000-4000-8000-000000000044', '20100000-0000-4000-8000-000000000010', '20100000-0000-4000-8000-000000000034', 'OS-S201-E', 'OS de Visita confirmada', 'preventiva', 'planejamento', '20100000-0000-4000-8000-000000000001'),
 ('20100000-0000-4000-8000-000000000046', '20100000-0000-4000-8000-000000000011', '20100000-0000-4000-8000-000000000035', 'OS-S201-G', 'OS do vizinho', 'preventiva', 'planejamento', '20100000-0000-4000-8000-000000000001');
insert into pcm.visita_ordens_servico (id, visita_id, os_id, cliente_id, sequencia, created_by) values
 ('20100000-0000-4000-8000-000000000070', '20100000-0000-4000-8000-000000000021', '20100000-0000-4000-8000-000000000042', '20100000-0000-4000-8000-000000000010', 1, '20100000-0000-4000-8000-000000000001'),
 ('20100000-0000-4000-8000-000000000071', '20100000-0000-4000-8000-000000000022', '20100000-0000-4000-8000-000000000043', '20100000-0000-4000-8000-000000000010', 1, '20100000-0000-4000-8000-000000000001'),
 ('20100000-0000-4000-8000-000000000072', '20100000-0000-4000-8000-000000000023', '20100000-0000-4000-8000-000000000044', '20100000-0000-4000-8000-000000000010', 1, '20100000-0000-4000-8000-000000000001'),
 ('20100000-0000-4000-8000-000000000073', '20100000-0000-4000-8000-000000000024', '20100000-0000-4000-8000-000000000046', '20100000-0000-4000-8000-000000000011', 1, '20100000-0000-4000-8000-000000000001');

-- ── Família 3: TAREFA ÓRFÃ ──────────────────────────────────────────────────
-- Mesma fixture de E01-S199: OS que chegou do Auvo sem ID de Chamado (par provisório de 1420) e
-- ainda sem decisão de triagem (1428). O monitor reusa `sso_listar_campo_a_conciliar` (1866).
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('20100000-0000-4000-8000-000000000036', 'CH-S201-H', '20100000-0000-4000-8000-000000000010', 'Chamado provisório do campo', '20100000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, auvo_task_id, created_by) values
 ('20100000-0000-4000-8000-000000000045', '20100000-0000-4000-8000-000000000010', '20100000-0000-4000-8000-000000000036', 'OS-S201-F', 'OS órfã vinda do campo', 'corretiva', 'em_execucao', 777006, '20100000-0000-4000-8000-000000000001');
insert into pcm.sso_contratos_origem_campo (id, integracao, versao, habilitado, definicao) values
 ('20100000-0000-4000-8000-000000000080', 'auvo', 'v-s201', true, '{
   "campos": {"taskId":"taskId","clienteId":"clienteId","titulo":"titulo","status":"status","ordem":"ordem",
     "descricao":"descricao","osExternaId":"osExternaId","chamadoId":"chamadoId","tecnicoId":"tecnicoId",
     "dataAgendada":"dataAgendada","checkIn":"checkIn","checkOut":"checkOut","detalhes":"detalhes"},
   "estados": {"aberta":"aberta"},
   "fuso": "America/Sao_Paulo"
 }'::jsonb);
insert into pcm.origem_campo_inbox (id, integracao, task_id, chave_evento, cliente_externo_id, payload) values
 ('20100000-0000-4000-8000-000000000081', 'auvo', 777006, 'evt-s201-a', '2010101', '{"taskId":"777006","clienteId":"2010101","titulo":"OS órfã vinda do campo","status":"aberta","ordem":"1"}'::jsonb);

-- A esteira de campo só aceita processamento vindo do pipeline (`service_role`).
set local request.jwt.claims = '{"role":"service_role"}';
insert into pcm.sso_origem_campo_processamentos (integracao, task_id, envelope_id, contrato_id, cliente_id, chamado_id, os_id, provisorio, motivo, projecao, resultado) values
 ('auvo', 777006, '20100000-0000-4000-8000-000000000081', '20100000-0000-4000-8000-000000000080', '20100000-0000-4000-8000-000000000010', '20100000-0000-4000-8000-000000000036', '20100000-0000-4000-8000-000000000045', true, 'referencia_ausente', '{"titulo":"OS órfã vinda do campo","statusCampo":"aberta","ordemExterna":"1","referenciaInvalida":false}'::jsonb, '{}'::jsonb);
reset request.jwt.claims;

-- Capacidade exigida (a mesma de 1427/1428/1866). O usuário (2) fica sem ela de propósito.
insert into config.sso_concessoes(usuario_id, acao, cliente_id) values
 ('20100000-0000-4000-8000-000000000001', 'execucao.validar', '20100000-0000-4000-8000-000000000010'),
 ('20100000-0000-4000-8000-000000000001', 'execucao.validar', '20100000-0000-4000-8000-000000000011');

set local role authenticated;
set local request.jwt.claims = '{"sub":"20100000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

-- AC-8: gate fechado por padrão recusa com erro NOMEADO. "Desligado" nunca pode parecer
-- "nenhuma exceção" — é a diferença que o monitor existe para mostrar.
select throws_ok(
  $$ select * from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000010',50) $$,
  '55000', 'consulta_desabilitada',
  'AC-8: gate fechado recusa com erro nomeado, não com lista vazia'
);

set local role postgres;
update pcm.sso_consulta_estado_campo_gate set habilitado = true where id;
set local role authenticated;

-- AC-1: as três famílias saem da MESMA consulta, uma linha cada neste cenário.
select is(
  (select count(*) from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000010',50)),
  3::bigint, 'AC-1: a consulta devolve as três famílias juntas');
select set_eq(
  $$ select tipo from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000010',50) $$,
  $$ values ('falha_envio'), ('visita_nao_confirmada'), ('tarefa_orfa') $$,
  'AC-1: cada linha diz a que família pertence');

-- AC-2/AC-3: falha de envio carrega ID externo, tentativas e último erro ("registrar ID externo,
-- tentativas e erro", critério literal de BL 004).
select results_eq(
  $$ select os_id, task_id, tentativas, ultimo_erro
       from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000010',50)
      where tipo = 'falha_envio' $$,
  $$ values ('20100000-0000-4000-8000-000000000040'::uuid, 777001::bigint, 3, 'timeout_auvo') $$,
  'AC-2/AC-3: falha de envio traz OS, ID externo, tentativas e último erro');
select is(
  (select visita_id from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000010',50) where tipo = 'falha_envio'),
  '20100000-0000-4000-8000-000000000020'::uuid, 'AC-2: falha de envio aponta a Visita envolvida');
select is(
  (select count(*) from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000010',50) where os_id = '20100000-0000-4000-8000-000000000041'),
  0::bigint, 'AC-3: tentativa já confirmada não é exceção');

-- AC-4: Visita não confirmada com janela aberta vira exceção, com zero tentativas.
select results_eq(
  $$ select os_id, visita_id, tentativas, ultimo_erro
       from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000010',50)
      where tipo = 'visita_nao_confirmada' $$,
  $$ values ('20100000-0000-4000-8000-000000000042'::uuid, '20100000-0000-4000-8000-000000000021'::uuid, 0, 'visita_planejada') $$,
  'AC-4: Visita não confirmada aparece com zero tentativas e o estado como motivo');
select is(
  (select count(*) from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000010',50) where os_id = '20100000-0000-4000-8000-000000000043'),
  0::bigint, 'AC-4: Visita cuja janela T−24 ainda não abriu não é exceção');
select is(
  (select count(*) from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000010',50) where os_id = '20100000-0000-4000-8000-000000000044'),
  0::bigint, 'AC-4: Visita confirmada dentro da janela não é exceção');

-- AC-5: tarefa órfã, pelo recorte reusado de 1866.
select results_eq(
  $$ select os_id, task_id, ultimo_erro
       from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000010',50)
      where tipo = 'tarefa_orfa' $$,
  $$ values ('20100000-0000-4000-8000-000000000045'::uuid, 777006::bigint, 'referencia_ausente') $$,
  'AC-5: tarefa órfã traz a OS provisória e o ID da tarefa Auvo de origem');
select is(
  (select visita_id from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000010',50) where tipo = 'tarefa_orfa'),
  null::uuid, 'AC-5: tarefa órfã não tem Visita — o nulo é a informação, não um buraco');

-- AC-2: o Cliente vem resolvido por nome, para o monitor não exigir outra consulta.
select is(
  (select distinct cliente_nome from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000010',50)),
  'Cliente S201', 'AC-2: cada linha identifica o Cliente');

-- AC-6: isolamento entre Clientes nos dois sentidos.
select is(
  (select count(*) from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000010',50) where os_id = '20100000-0000-4000-8000-000000000046'),
  0::bigint, 'AC-6: exceção do vizinho não vaza para a consulta deste Cliente');
select is(
  (select count(*) from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000011',50)),
  1::bigint, 'AC-6: o Cliente vizinho tem a própria exceção');

-- Parâmetros: ator diferente da sessão e limite fora da faixa param antes de ler dado.
select throws_ok(
  $$ select * from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000002','20100000-0000-4000-8000-000000000010',50) $$,
  '22023', 'parametros_invalidos', 'ator diferente da sessão é recusado');
select throws_ok(
  $$ select * from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000010',999) $$,
  '22023', 'parametros_invalidos', 'limite fora da faixa é recusado');

-- AC-9 (negado): sem a capacidade, o monitor é recusado com erro próprio.
set local request.jwt.claims = '{"sub":"20100000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}';
select throws_ok(
  $$ select * from pcm.sso_listar_excecoes_auvo_t24('20100000-0000-4000-8000-000000000002','20100000-0000-4000-8000-000000000010',50) $$,
  '42501', 'sem_acesso', 'AC-9: sem a capacidade execucao.validar, o monitor é negado');

select * from finish();
rollback;
