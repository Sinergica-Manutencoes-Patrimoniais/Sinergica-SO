-- E01-S199 — "Campo a conciliar" é fila de ENTRADA do Kanban (BL 007 AC-5 do Pacote Consolidado
-- do Fabrício: "Solicitação, Preventiva e Campo a conciliar são filas de entrada").
--
-- A regra que esta prova fixa: só entra na fila a OS que chegou do campo SEM Chamado (provisória,
-- migration 1420) e que o PCM ainda NÃO conciliou (sem decisão de triagem, migration 1428).
-- Conciliada, unida a outro Chamado ou com o Chamado encerrado, ela SAI da fila — senão a coluna
-- viraria um depósito que nunca esvazia.
begin;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('19900000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's199-pcm@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('19900000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's199-sem-acesso@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('19900000-0000-4000-8000-000000000001', 'superadmin', 'S199 PCM', true),
 ('19900000-0000-4000-8000-000000000002', 'colaborador', 'S199 Sem acesso', true);

insert into pcm.clientes (id, nome, ativo, auvo_id, created_by) values
 ('19900000-0000-4000-8000-000000000010', 'Cliente S199', true, 1990101, '19900000-0000-4000-8000-000000000001'),
 ('19900000-0000-4000-8000-000000000011', 'Cliente S199 vizinho', true, 1990102, '19900000-0000-4000-8000-000000000001');

-- `definicao` mapeia os campos lógicos 1:1 sobre o payload cru — `sso_conferir_projecao_origem`
-- (1422) exige que a projeção guardada bata com o payload da inbox campo a campo.
insert into pcm.sso_contratos_origem_campo (id, integracao, versao, habilitado, definicao) values
 ('19900000-0000-4000-8000-000000000020', 'auvo', 'v-s199', true, '{
   "campos": {"taskId":"taskId","clienteId":"clienteId","titulo":"titulo","status":"status","ordem":"ordem",
     "descricao":"descricao","osExternaId":"osExternaId","chamadoId":"chamadoId","tecnicoId":"tecnicoId",
     "dataAgendada":"dataAgendada","checkIn":"checkIn","checkOut":"checkOut","detalhes":"detalhes"},
   "estados": {"aberta":"aberta"},
   "fuso": "America/Sao_Paulo"
 }'::jsonb);

-- Quatro cenários, um por linha de processamento provisório.
insert into pcm.origem_campo_inbox (id, integracao, task_id, chave_evento, cliente_externo_id, payload) values
 ('19900000-0000-4000-8000-000000000030', 'auvo', 1990201, 'evt-s199-a', '1990101', '{"taskId":"1990201","clienteId":"1990101","titulo":"OS vinda do campo A","status":"aberta","ordem":"1"}'::jsonb),
 ('19900000-0000-4000-8000-000000000031', 'auvo', 1990202, 'evt-s199-b', '1990101', '{"taskId":"1990202","clienteId":"1990101","titulo":"OS vinda do campo B","status":"aberta","ordem":"1"}'::jsonb),
 ('19900000-0000-4000-8000-000000000032', 'auvo', 1990203, 'evt-s199-c', '1990101', '{"taskId":"1990203","clienteId":"1990101","titulo":"OS vinda do campo C","status":"aberta","ordem":"1"}'::jsonb),
 ('19900000-0000-4000-8000-000000000033', 'auvo', 1990204, 'evt-s199-d', '1990101', '{"taskId":"1990204","clienteId":"1990101","titulo":"OS vinda do campo D","status":"aberta","ordem":"1"}'::jsonb),
 ('19900000-0000-4000-8000-000000000034', 'auvo', 1990205, 'evt-s199-e', '1990102', '{"taskId":"1990205","clienteId":"1990102","titulo":"OS vinda do campo E","status":"aberta","ordem":"1"}'::jsonb);

-- (A) provisória e NÃO conciliada  → entra na fila.
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('19900000-0000-4000-8000-000000000040', 'CH-S199-A', '19900000-0000-4000-8000-000000000010', 'Chamado provisório do campo A', '19900000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, auvo_task_id, created_by) values
 ('19900000-0000-4000-8000-000000000041', '19900000-0000-4000-8000-000000000010', '19900000-0000-4000-8000-000000000040', 'OS-S199-A', 'OS vinda do campo A', 'corretiva', 'em_execucao', 1990201, '19900000-0000-4000-8000-000000000001');

-- (B) provisória mas JÁ conciliada (decisão de triagem registrada) → sai da fila.
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('19900000-0000-4000-8000-000000000042', 'CH-S199-B', '19900000-0000-4000-8000-000000000010', 'Chamado provisório já triado', '19900000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, auvo_task_id, created_by) values
 ('19900000-0000-4000-8000-000000000043', '19900000-0000-4000-8000-000000000010', '19900000-0000-4000-8000-000000000042', 'OS-S199-B', 'OS vinda do campo B', 'corretiva', 'em_execucao', 1990202, '19900000-0000-4000-8000-000000000001');

-- (C) NÃO provisória (chegou com ID de Chamado) → nunca entra na fila.
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('19900000-0000-4000-8000-000000000044', 'CH-S199-C', '19900000-0000-4000-8000-000000000010', 'Chamado identificado na origem', '19900000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, auvo_task_id, created_by) values
 ('19900000-0000-4000-8000-000000000045', '19900000-0000-4000-8000-000000000010', '19900000-0000-4000-8000-000000000044', 'OS-S199-C', 'OS vinda do campo C', 'corretiva', 'em_execucao', 1990203, '19900000-0000-4000-8000-000000000001');

-- (D) provisória, não conciliada, mas com o Chamado ENCERRADO → sai da fila.
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('19900000-0000-4000-8000-000000000046', 'CH-S199-D', '19900000-0000-4000-8000-000000000010', 'Chamado provisório encerrado', '19900000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, auvo_task_id, created_by) values
 ('19900000-0000-4000-8000-000000000047', '19900000-0000-4000-8000-000000000010', '19900000-0000-4000-8000-000000000046', 'OS-S199-D', 'OS vinda do campo D', 'corretiva', 'finalizado', 1990204, '19900000-0000-4000-8000-000000000001');
-- Encerra DEPOIS de criar a OS: `sso_guardar_os_chamado_encerrado` recusa, com razão, criar OS
-- dentro de Chamado já encerrado.
update pcm.chamados set sso_encerrado_em = now() where id = '19900000-0000-4000-8000-000000000046';

-- (E) provisória e não conciliada, porém de OUTRO Cliente → não vaza para a fila do Cliente pedido.
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('19900000-0000-4000-8000-000000000048', 'CH-S199-E', '19900000-0000-4000-8000-000000000011', 'Chamado provisório do vizinho', '19900000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, auvo_task_id, created_by) values
 ('19900000-0000-4000-8000-000000000049', '19900000-0000-4000-8000-000000000011', '19900000-0000-4000-8000-000000000048', 'OS-S199-E', 'OS vinda do campo E', 'corretiva', 'em_execucao', 1990205, '19900000-0000-4000-8000-000000000001');

-- A esteira de campo só aceita processamento vindo do pipeline: `sso_observar_entrega_origem`
-- exige `auth.role() = 'service_role'`. A fixture entra pelo mesmo papel que a produção usa.
set local request.jwt.claims = '{"role":"service_role"}';

insert into pcm.sso_origem_campo_processamentos (integracao, task_id, envelope_id, contrato_id, cliente_id, chamado_id, os_id, provisorio, motivo, projecao, resultado) values
 ('auvo', 1990201, '19900000-0000-4000-8000-000000000030', '19900000-0000-4000-8000-000000000020', '19900000-0000-4000-8000-000000000010', '19900000-0000-4000-8000-000000000040', '19900000-0000-4000-8000-000000000041', true,  'referencia_ausente', '{"titulo":"OS vinda do campo A","statusCampo":"aberta","ordemExterna":"1","referenciaInvalida":false}'::jsonb, '{}'::jsonb),
 ('auvo', 1990202, '19900000-0000-4000-8000-000000000031', '19900000-0000-4000-8000-000000000020', '19900000-0000-4000-8000-000000000010', '19900000-0000-4000-8000-000000000042', '19900000-0000-4000-8000-000000000043', true,  'referencia_ausente', '{"titulo":"OS vinda do campo B","statusCampo":"aberta","ordemExterna":"1","referenciaInvalida":false}'::jsonb, '{}'::jsonb),
 ('auvo', 1990203, '19900000-0000-4000-8000-000000000032', '19900000-0000-4000-8000-000000000020', '19900000-0000-4000-8000-000000000010', '19900000-0000-4000-8000-000000000044', '19900000-0000-4000-8000-000000000045', false, 'os_existente',  '{"titulo":"OS vinda do campo C","statusCampo":"aberta","ordemExterna":"1","referenciaInvalida":false}'::jsonb, '{}'::jsonb),
 ('auvo', 1990204, '19900000-0000-4000-8000-000000000033', '19900000-0000-4000-8000-000000000020', '19900000-0000-4000-8000-000000000010', '19900000-0000-4000-8000-000000000046', '19900000-0000-4000-8000-000000000047', true,  'referencia_ausente', '{"titulo":"OS vinda do campo D","statusCampo":"aberta","ordemExterna":"1","referenciaInvalida":false}'::jsonb, '{}'::jsonb),
 ('auvo', 1990205, '19900000-0000-4000-8000-000000000034', '19900000-0000-4000-8000-000000000020', '19900000-0000-4000-8000-000000000011', '19900000-0000-4000-8000-000000000048', '19900000-0000-4000-8000-000000000049', true,  'referencia_ausente', '{"titulo":"OS vinda do campo E","statusCampo":"aberta","ordemExterna":"1","referenciaInvalida":false}'::jsonb, '{}'::jsonb);

reset request.jwt.claims;

-- Concessão individual da capacidade que a fila exige (mesma de 1427/1428). O usuário (2) fica
-- deliberadamente sem ela, para provar o caminho negado.
insert into config.sso_concessoes(usuario_id, acao, cliente_id) values
 ('19900000-0000-4000-8000-000000000001', 'execucao.validar', '19900000-0000-4000-8000-000000000010'),
 ('19900000-0000-4000-8000-000000000001', 'execucao.validar', '19900000-0000-4000-8000-000000000011');

-- (B) ganhou decisão de triagem — é o que a tira da fila.
insert into pcm.sso_triagem_chamado_campo_decisoes (request_id, cliente_id, chamado_id, os_id, revisao, ator_id, acao, motivo, payload, resultado) values
 ('19900000-0000-4000-8000-000000000050', '19900000-0000-4000-8000-000000000010', '19900000-0000-4000-8000-000000000042', '19900000-0000-4000-8000-000000000043', 1, '19900000-0000-4000-8000-000000000001', 'confirmar', 'conciliado no teste', '{}'::jsonb, '{}'::jsonb);

set local role authenticated;
set local request.jwt.claims = '{"sub":"19900000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

-- AC-F3/segurança: gate fechado por padrão recusa com erro NOMEADO, não permission denied nem
-- lista vazia — a diferença entre "não ativado" e "não existe nada" tem de ser visível.
select throws_ok(
  $$ select * from pcm.sso_listar_campo_a_conciliar('19900000-0000-4000-8000-000000000001','19900000-0000-4000-8000-000000000010',50) $$,
  '55000', 'consulta_desabilitada',
  'gate fechado por padrão recusa com erro nomeado'
);

set local role postgres;
update pcm.sso_consulta_estado_campo_gate set habilitado = true where id;
set local role authenticated;

-- AC-1: só a OS provisória ainda não conciliada aparece.
select is(
  (select count(*) from pcm.sso_listar_campo_a_conciliar('19900000-0000-4000-8000-000000000001','19900000-0000-4000-8000-000000000010',50)),
  1::bigint,
  'fila traz exatamente 1 item: a provisória ainda não conciliada'
);
select is(
  (select os_id from pcm.sso_listar_campo_a_conciliar('19900000-0000-4000-8000-000000000001','19900000-0000-4000-8000-000000000010',50)),
  '19900000-0000-4000-8000-000000000041'::uuid,
  'o item da fila é a OS provisória (A)'
);

-- AC-2: conciliada sai da fila (é o que faz a coluna esvaziar).
select is(
  (select count(*) from pcm.sso_listar_campo_a_conciliar('19900000-0000-4000-8000-000000000001','19900000-0000-4000-8000-000000000010',50) where os_id = '19900000-0000-4000-8000-000000000043'),
  0::bigint,
  'OS com decisão de triagem registrada não aparece mais na fila'
);
-- AC-3: OS que chegou com Chamado identificado nunca entra.
select is(
  (select count(*) from pcm.sso_listar_campo_a_conciliar('19900000-0000-4000-8000-000000000001','19900000-0000-4000-8000-000000000010',50) where os_id = '19900000-0000-4000-8000-000000000045'),
  0::bigint,
  'OS não provisória nunca entra na fila'
);
-- AC-4: Chamado encerrado sai da fila.
select is(
  (select count(*) from pcm.sso_listar_campo_a_conciliar('19900000-0000-4000-8000-000000000001','19900000-0000-4000-8000-000000000010',50) where os_id = '19900000-0000-4000-8000-000000000047'),
  0::bigint,
  'Chamado encerrado não fica na fila de entrada'
);
-- Isolamento por Cliente: a fila de um Cliente não mostra a do vizinho.
select is(
  (select count(*) from pcm.sso_listar_campo_a_conciliar('19900000-0000-4000-8000-000000000001','19900000-0000-4000-8000-000000000011',50)),
  1::bigint,
  'o Cliente vizinho tem a própria fila, com o próprio item'
);
select is(
  (select count(*) from pcm.sso_listar_campo_a_conciliar('19900000-0000-4000-8000-000000000001','19900000-0000-4000-8000-000000000010',50) where os_id = '19900000-0000-4000-8000-000000000049'),
  0::bigint,
  'item do vizinho não vaza para a fila do Cliente pedido'
);

-- O cartão precisa do motivo e do identificador externo para o PCM decidir sem abrir a OS.
select is(
  (select motivo from pcm.sso_listar_campo_a_conciliar('19900000-0000-4000-8000-000000000001','19900000-0000-4000-8000-000000000010',50)),
  'referencia_ausente', 'o cartão carrega o motivo da provisoriedade'
);
select is(
  (select task_id from pcm.sso_listar_campo_a_conciliar('19900000-0000-4000-8000-000000000001','19900000-0000-4000-8000-000000000010',50)),
  1990201::bigint, 'o cartão carrega o ID da tarefa Auvo de origem'
);

-- Parâmetros: ator diferente da sessão e limite fora da faixa são recusados antes de ler dado.
select throws_ok(
  $$ select * from pcm.sso_listar_campo_a_conciliar('19900000-0000-4000-8000-000000000002','19900000-0000-4000-8000-000000000010',50) $$,
  '22023', 'parametros_invalidos', 'ator diferente da sessão é recusado'
);
select throws_ok(
  $$ select * from pcm.sso_listar_campo_a_conciliar('19900000-0000-4000-8000-000000000001','19900000-0000-4000-8000-000000000010',999) $$,
  '22023', 'parametros_invalidos', 'limite fora da faixa é recusado'
);

-- Negado: quem não tem a capacidade de validação não enxerga a fila.
set local request.jwt.claims = '{"sub":"19900000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}';
select throws_ok(
  $$ select * from pcm.sso_listar_campo_a_conciliar('19900000-0000-4000-8000-000000000002','19900000-0000-4000-8000-000000000010',50) $$,
  '42501', 'sem_acesso', 'sem a capacidade execucao.validar, a fila é negada'
);

select * from finish();
rollback;
