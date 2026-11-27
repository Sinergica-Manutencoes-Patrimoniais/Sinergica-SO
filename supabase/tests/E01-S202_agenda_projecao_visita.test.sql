-- E01-S202 — Agenda do Técnico como projeção da Visita.
--
-- O QUE ESTA PROVA FIXA, ANTES DE QUALQUER OUTRA COISA: a evidência que o Fabrício levantou na
-- reunião — "Agenda do Técnico sem alocações na mesma semana em que o calendário operacional
-- apresentava dezenas de Chamados" — não pode voltar a acontecer. A asserção central (AC-1) monta
-- exatamente esse cenário: uma semana com Visitas e OS vinculadas, o cadastro manual
-- `pcm.agenda_tecnico` VAZIO nessa semana, e a projeção devolvendo as alocações mesmo assim.
-- Se a projeção vier vazia nessa semana, este teste falha — que é o critério de aceitação dele.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
set local app.auvo_sync_write = 'true';
select plan(37);

-- ── Fixture ──────────────────────────────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('20200000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's202-pcm@test.local',        crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('20200000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's202-sem-acesso@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('20200000-0000-4000-8000-000000000001', 'superadmin', 'S202 PCM', true),
 ('20200000-0000-4000-8000-000000000002', 'superadmin', 'S202 Sem concessão', true);

insert into pcm.clientes (id, nome, ativo, created_by) values
 ('20200000-0000-4000-8000-000000000010', 'Cliente S202',         true, '20200000-0000-4000-8000-000000000001'),
 ('20200000-0000-4000-8000-000000000011', 'Cliente S202 vizinho', true, '20200000-0000-4000-8000-000000000001');

insert into pcm.funcionarios (id, nome) values
 ('20200000-0000-4000-8000-000000000020', 'Ana Técnica S202'),
 ('20200000-0000-4000-8000-000000000021', 'Bruno Responsável S202'),
 ('20200000-0000-4000-8000-000000000022', 'Carla Vizinha S202');

-- Semana da evidência: 2026-11-23 (segunda-feira ISO) a 2026-11-29.
-- (A) Visita planejada, de manhã, com equipe e DUAS OS vinculadas → é a alocação que precisa
--     aparecer na Agenda do Técnico.
insert into pcm.visitas (id, cliente_id, inicio_em, fim_em, fuso, natureza, estado, responsavel_id, created_by) values
 ('20200000-0000-4000-8000-000000000030', '20200000-0000-4000-8000-000000000010', '2026-11-23 11:00+00', '2026-11-23 15:00+00', 'America/Sao_Paulo', 'regular', 'planejada', '20200000-0000-4000-8000-000000000020', '20200000-0000-4000-8000-000000000001'),
 -- (B) Visita confirmada, à tarde, SEM equipe montada, só com responsável → tem de aparecer
 --     mesmo assim; Visita com dono e sem equipe sumindo da agenda é o vazio desta story.
 ('20200000-0000-4000-8000-000000000031', '20200000-0000-4000-8000-000000000010', '2026-11-24 16:00+00', '2026-11-24 20:00+00', 'America/Sao_Paulo', 'regular', 'confirmada', '20200000-0000-4000-8000-000000000021', '20200000-0000-4000-8000-000000000001'),
 -- (C) Visita cancelada na mesma semana → não é compromisso de ninguém.
 ('20200000-0000-4000-8000-000000000032', '20200000-0000-4000-8000-000000000010', '2026-11-25 11:00+00', '2026-11-25 15:00+00', 'America/Sao_Paulo', 'regular', 'cancelada', '20200000-0000-4000-8000-000000000020', '20200000-0000-4000-8000-000000000001'),
 -- (D) Visita ainda em rascunho → compromisso que ninguém assumiu não ocupa agenda de técnico.
 ('20200000-0000-4000-8000-000000000033', '20200000-0000-4000-8000-000000000010', '2026-11-26 11:00+00', '2026-11-26 15:00+00', 'America/Sao_Paulo', 'regular', 'rascunho', '20200000-0000-4000-8000-000000000020', '20200000-0000-4000-8000-000000000001'),
 -- (E) Visita do Cliente vizinho → não pode vazar para a agenda do Cliente pedido.
 ('20200000-0000-4000-8000-000000000034', '20200000-0000-4000-8000-000000000011', '2026-11-25 11:00+00', '2026-11-25 15:00+00', 'America/Sao_Paulo', 'regular', 'planejada', '20200000-0000-4000-8000-000000000022', '20200000-0000-4000-8000-000000000001'),
 -- (F) Visita integral (manhã + tarde) → prova a derivação do período.
 ('20200000-0000-4000-8000-000000000035', '20200000-0000-4000-8000-000000000010', '2026-11-27 11:00+00', '2026-11-27 20:00+00', 'America/Sao_Paulo', 'extra', 'planejada', '20200000-0000-4000-8000-000000000020', '20200000-0000-4000-8000-000000000001');

-- A exclusão de Visita dispensada por feriado (pcm.sso_visitas_suprimidas_feriado) está no código
-- da projeção, imitando 1284. Não é exercitada aqui: a fixture exigiria feriado declarado, regra
-- contratual e série de calendário inteiros — cadeia já coberta pelos testes de E01-S166.

insert into pcm.visita_equipes (id, visita_id, cliente_id, funcionario_id, papel, created_by) values
 ('20200000-0000-4000-8000-000000000040', '20200000-0000-4000-8000-000000000030', '20200000-0000-4000-8000-000000000010', '20200000-0000-4000-8000-000000000020', 'Técnica', '20200000-0000-4000-8000-000000000001'),
 ('20200000-0000-4000-8000-000000000041', '20200000-0000-4000-8000-000000000032', '20200000-0000-4000-8000-000000000010', '20200000-0000-4000-8000-000000000020', 'Técnica', '20200000-0000-4000-8000-000000000001'),
 ('20200000-0000-4000-8000-000000000042', '20200000-0000-4000-8000-000000000033', '20200000-0000-4000-8000-000000000010', '20200000-0000-4000-8000-000000000020', 'Técnica', '20200000-0000-4000-8000-000000000001'),
 ('20200000-0000-4000-8000-000000000043', '20200000-0000-4000-8000-000000000034', '20200000-0000-4000-8000-000000000011', '20200000-0000-4000-8000-000000000022', 'Técnica', '20200000-0000-4000-8000-000000000001'),
 ('20200000-0000-4000-8000-000000000044', '20200000-0000-4000-8000-000000000035', '20200000-0000-4000-8000-000000000010', '20200000-0000-4000-8000-000000000020', 'Técnica', '20200000-0000-4000-8000-000000000001');

insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('20200000-0000-4000-8000-000000000050', 'CH-S202-1', '20200000-0000-4000-8000-000000000010', 'Chamado S202 1', '20200000-0000-4000-8000-000000000001'),
 ('20200000-0000-4000-8000-000000000051', 'CH-S202-2', '20200000-0000-4000-8000-000000000010', 'Chamado S202 2', '20200000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, created_by) values
 ('20200000-0000-4000-8000-000000000052', '20200000-0000-4000-8000-000000000010', '20200000-0000-4000-8000-000000000050', 'OS-S202-1', 'OS S202 1', 'corretiva', 'em_execucao', '20200000-0000-4000-8000-000000000001'),
 ('20200000-0000-4000-8000-000000000053', '20200000-0000-4000-8000-000000000010', '20200000-0000-4000-8000-000000000051', 'OS-S202-2', 'OS S202 2', 'corretiva', 'em_execucao', '20200000-0000-4000-8000-000000000001');
insert into pcm.visita_ordens_servico (id, visita_id, os_id, cliente_id, sequencia, created_by) values
-- Sequência INVERTIDA de propósito (a OS criada primeiro é a segunda da Visita): assim a ordem
-- da lista prova que vem da sequência da Visita, não da ordem alfabética do número.
 ('20200000-0000-4000-8000-000000000054', '20200000-0000-4000-8000-000000000030', '20200000-0000-4000-8000-000000000052', '20200000-0000-4000-8000-000000000010', 2, '20200000-0000-4000-8000-000000000001'),
 ('20200000-0000-4000-8000-000000000055', '20200000-0000-4000-8000-000000000030', '20200000-0000-4000-8000-000000000053', '20200000-0000-4000-8000-000000000010', 1, '20200000-0000-4000-8000-000000000001');

-- DEF-03: a primeira OS tem tarefa sincronizada. A segunda tem hora planejada só no PCM.
update pcm.ordens_servico set auvo_task_id = 202001, data_agendada = '2026-11-23 23:42+00'
 where id = '20200000-0000-4000-8000-000000000052';
update pcm.ordens_servico set data_agendada = '2026-11-23 17:00+00'
 where id = '20200000-0000-4000-8000-000000000053';

-- Capacidade: só o usuário (1) confirma Visita, e só no Cliente S202. O (2) fica sem nenhuma, de
-- propósito — é o caminho negado.
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('20200000-0000-4000-8000-000000000001', 'visita.confirmar', '20200000-0000-4000-8000-000000000010');

-- ── AC-6: gate fechado se anuncia com erro NOMEADO, não com lista vazia ──────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"20200000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select throws_ok(
  $$ select * from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 100) $$,
  '55000', 'agenda_capacidade_bloqueada',
  'AC-6: gate fechado por padrão recusa com erro nomeado, nunca com agenda vazia'
);

select throws_ok(
  $$ select * from pcm.sso_listar_agenda_tecnico_com_horarios_auvo(null, date '2026-11-23', 100) $$,
  '55000', 'agenda_capacidade_bloqueada',
  'DEF-03: a projeção com horários respeita o gate da Agenda'
);

set local role postgres;
update pcm.capacidade_agenda_tecnico_gate set habilitado = true where id;
set local role authenticated;

-- ── AC-1: O CENÁRIO DA EVIDÊNCIA DO CLIENTE ─────────────────────────────────────────────────
-- Semana com Visita e OS vinculadas: o cadastro manual está vazio (é o sintoma de 2026-11-13) e
-- a projeção mostra as alocações assim mesmo.
select is(
  (select count(*) from pcm.agenda_tecnico a
    where a.cliente_id = '20200000-0000-4000-8000-000000000010'
      and a.data >= date '2026-11-23' and a.data < date '2026-11-30' and a.deleted_at is null),
  0::bigint,
  'AC-1: o cadastro manual continua vazio nesta semana — é exatamente a evidência do cliente'
);
select cmp_ok(
  (select count(*) from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 100)),
  '>', 0::bigint,
  'AC-1: a semana tem Visita, então a Agenda do Técnico projetada NÃO vem vazia'
);
select is(
  (select count(*) from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 100)),
  3::bigint,
  'AC-1: três alocações na semana (Ana em A e F, Bruno responsável em B)'
);

-- ── AC-2: a alocação mostra a Visita com as OS vinculadas ───────────────────────────────────
select is(
  (select quantidade_os from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 100)
    where visita_id = '20200000-0000-4000-8000-000000000030'),
  2, 'AC-2: a Visita (A) leva junto as duas OS vinculadas'
);
select is(
  (select os_numeros from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 100)
    where visita_id = '20200000-0000-4000-8000-000000000030'),
  -- O número da OS é derivado do Chamado pela trigger `sso_numero_os_chamado` (E01-S167); é por
  -- isso que a lista traz CH-*, e não o texto passado no insert.
  array['CH-S202-2', 'CH-S202-1'],
  'AC-2: os números das OS vêm na ordem da sequência da Visita, não na do número'
);
select is(
  (select os_numeros from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 100)
    where visita_id = '20200000-0000-4000-8000-000000000031'),
  array[]::text[],
  'AC-2: Visita sem OS vinculada aparece com lista vazia, não some da agenda'
);

-- ── AC-3: equipe e responsável ──────────────────────────────────────────────────────────────
select is(
  (select funcionario_id from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 100)
    where visita_id = '20200000-0000-4000-8000-000000000030'),
  '20200000-0000-4000-8000-000000000020'::uuid,
  'AC-3: o membro da equipe vigente é quem aparece na linha da Visita (A)'
);
select is(
  (select papel from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 100)
    where visita_id = '20200000-0000-4000-8000-000000000031'),
  'Responsável',
  'AC-3: Visita sem equipe montada entra pela responsável, com papel explícito'
);

-- ── AC-4: o que não é compromisso não entra ─────────────────────────────────────────────────
select is(
  (select count(*) from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 100)
    where visita_id = '20200000-0000-4000-8000-000000000032'),
  0::bigint, 'AC-4: Visita cancelada não ocupa a agenda do técnico'
);
select is(
  (select count(*) from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 100)
    where visita_id = '20200000-0000-4000-8000-000000000033'),
  0::bigint, 'AC-4: Visita em rascunho não ocupa a agenda do técnico'
);

-- ── AC-5: isolamento por Cliente ────────────────────────────────────────────────────────────
select is(
  (select count(*) from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 100)
    where cliente_id = '20200000-0000-4000-8000-000000000011'),
  0::bigint, 'AC-5: Visita de Cliente sem concessão não vaza para a agenda'
);
select throws_ok(
  $$ select * from pcm.sso_listar_agenda_tecnico_projetada('20200000-0000-4000-8000-000000000011', date '2026-11-23', 100) $$,
  '42501', 'sem_acesso',
  'AC-5: pedir explicitamente o Cliente sem concessão é negado, não devolvido vazio'
);

-- ── AC-8: período derivado da própria Visita, no fuso dela ──────────────────────────────────
select is(
  (select periodo from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 100)
    where visita_id = '20200000-0000-4000-8000-000000000030'),
  'manha', 'AC-8: Visita que termina ao meio-dia local é de manhã'
);
select is(
  (select periodo from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 100)
    where visita_id = '20200000-0000-4000-8000-000000000031'),
  'tarde', 'AC-8: Visita que começa depois do meio-dia local é de tarde'
);
select is(
  (select periodo from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 100)
    where visita_id = '20200000-0000-4000-8000-000000000035'),
  'integral', 'AC-8: Visita que cruza o meio-dia local é integral'
);

-- DEF-03: a tarefa de 23:42 UTC aparece como 20:42 em America/Sao_Paulo.
select is(
  (select horarios_auvo from pcm.sso_listar_agenda_tecnico_com_horarios_auvo(null, date '2026-11-23', 100)
    where visita_id = '20200000-0000-4000-8000-000000000030'),
  array['20:42'],
  'DEF-03: devolve taskDate no fuso da Visita e ignora o horário PCM sem tarefa Auvo'
);
select is(
  (select horarios_auvo from pcm.sso_listar_agenda_tecnico_com_horarios_auvo(null, date '2026-11-23', 100)
    where visita_id = '20200000-0000-4000-8000-000000000031'),
  array[]::text[],
  'DEF-03: sem tarefa com hora, lista vazia mantém o período como fallback'
);
set local role postgres;
update pcm.ordens_servico set auvo_task_id = 202002, data_agendada = '2026-11-23 17:00+00'
 where id = '20200000-0000-4000-8000-000000000053';
set local role authenticated;
select is(
  (select horarios_auvo from pcm.sso_listar_agenda_tecnico_com_horarios_auvo(null, date '2026-11-23', 100)
    where visita_id = '20200000-0000-4000-8000-000000000030'),
  array['14:00', '20:42'],
  'DEF-03: quando duas tarefas têm horários diferentes, devolve ambos em ordem'
);
set local role postgres;
update pcm.ordens_servico set data_agendada = '2026-11-23 23:42+00'
 where id = '20200000-0000-4000-8000-000000000053';
set local role authenticated;
select is(
  (select horarios_auvo from pcm.sso_listar_agenda_tecnico_com_horarios_auvo(null, date '2026-11-23', 100)
    where visita_id = '20200000-0000-4000-8000-000000000030'),
  array['20:42'],
  'DEF-03: tarefas no mesmo horário não repetem o rótulo'
);
set local role postgres;
update pcm.ordens_servico set data_agendada = null
 where id = '20200000-0000-4000-8000-000000000053';
update pcm.visita_ordens_servico
   set encerrado_em = now(), encerrado_por = created_by, encerramento_motivo = 'Teste DEF-03'
 where id = '20200000-0000-4000-8000-000000000054';
set local role authenticated;
select is(
  (select horarios_auvo from pcm.sso_listar_agenda_tecnico_com_horarios_auvo(null, date '2026-11-23', 100)
    where visita_id = '20200000-0000-4000-8000-000000000030'),
  array[]::text[],
  'DEF-03: ignora tarefa sem hora e tarefa de OS com vínculo encerrado'
);

-- ── AC-6/AC-9: vazio, parâmetro inválido e negado são TRÊS coisas diferentes ────────────────
select is(
  (select count(*) from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-12-28', 100)),
  0::bigint, 'AC-6: semana realmente sem Visita devolve zero linhas, sem erro'
);
select throws_ok(
  $$ select * from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-24', 100) $$,
  '22023', 'consulta_invalida', 'AC-9: semana que não começa na segunda é recusada'
);
select throws_ok(
  $$ select * from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 5000) $$,
  '22023', 'consulta_invalida', 'AC-9: limite fora da faixa é recusado antes de ler dado'
);
set local request.jwt.claims = '{"sub":"20200000-0000-4000-8000-000000000002","role":"authenticated","user_role":"superadmin"}';
select throws_ok(
  $$ select * from pcm.sso_listar_agenda_tecnico_projetada(null, date '2026-11-23', 100) $$,
  '42501', 'sem_acesso',
  'AC-6: sem a capacidade visita.confirmar em nenhum Cliente, a agenda é negada — não vazia'
);
select ok(
  not has_function_privilege('anon', 'pcm.sso_listar_agenda_tecnico_projetada(uuid,date,integer)', 'execute'),
  'AC-9: anon não executa a projeção'
);

select throws_ok(
  $$ select * from pcm.sso_listar_agenda_tecnico_com_horarios_auvo(null, date '2026-11-23', 100) $$,
  '42501', 'sem_acesso',
  'DEF-03: horários seguem a mesma autorização por Cliente da projeção'
);
set local request.jwt.claims = '{"sub":"20200000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select throws_ok(
  $$ select * from pcm.sso_listar_agenda_tecnico_com_horarios_auvo('20200000-0000-4000-8000-000000000011', date '2026-11-23', 100) $$,
  '42501', 'sem_acesso',
  'DEF-03: a concessão em um Cliente não autoriza consultar outro'
);
select ok(
  not has_function_privilege('anon', 'pcm.sso_listar_agenda_tecnico_com_horarios_auvo(uuid,date,integer)', 'execute'),
  'DEF-03: anon não executa a consulta de horários'
);
select ok(
  not has_function_privilege('service_role', 'pcm.sso_listar_agenda_tecnico_com_horarios_auvo(uuid,date,integer)', 'execute'),
  'DEF-03: a consulta só é concedida a authenticated'
);

-- ── AC-7: o cadastro manual está aposentado, não destruído ──────────────────────────────────
-- Histórico pré-existente entra com a guarda desligada — é justamente o que já estava no banco
-- antes desta story e que a decisão do cliente mandou NÃO destruir.
set local role postgres;
alter table pcm.agenda_tecnico disable trigger sso_agenda_tecnico_obsoleta;
insert into pcm.agenda_tecnico (id, funcionario_id, cliente_id, data, hora_inicio, created_by) values
 ('20200000-0000-4000-8000-000000000060', '20200000-0000-4000-8000-000000000020', '20200000-0000-4000-8000-000000000010', '2026-10-05', '08:00', '20200000-0000-4000-8000-000000000001');
alter table pcm.agenda_tecnico enable trigger sso_agenda_tecnico_obsoleta;

set local role authenticated;
set local request.jwt.claims = '{"sub":"20200000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select throws_ok(
  $$ insert into pcm.agenda_tecnico (funcionario_id, cliente_id, data, created_by)
     values ('20200000-0000-4000-8000-000000000020', '20200000-0000-4000-8000-000000000010', '2026-11-23', '20200000-0000-4000-8000-000000000001') $$,
  '55000', 'agenda_tecnico_obsoleta',
  'AC-7: cadastro manual novo é recusado com erro nomeado, não aceito em silêncio'
);
select throws_ok(
  $$ update pcm.agenda_tecnico set hora_inicio = '09:00'
      where id = '20200000-0000-4000-8000-000000000060' $$,
  '55000', 'agenda_tecnico_obsoleta',
  'AC-7: editar o conteúdo de uma alocação manual antiga também é recusado'
);
select throws_ok(
  $$ delete from pcm.agenda_tecnico where id = '20200000-0000-4000-8000-000000000060' $$,
  '55000', 'agenda_tecnico_obsoleta',
  'AC-7: apagar histórico é recusado — aposentar não é destruir'
);
select is(
  (select hora_inicio from pcm.agenda_tecnico where id = '20200000-0000-4000-8000-000000000060'),
  '08:00'::time,
  'AC-7: o histórico lançado à mão continua legível, intacto'
);
select lives_ok(
  $$ update pcm.agenda_tecnico set deleted_at = now(), updated_by = '20200000-0000-4000-8000-000000000001'
      where id = '20200000-0000-4000-8000-000000000060' $$,
  'AC-7: retirar da tela (soft-delete) continua permitido, preservando a linha'
);
select matches(
  (select obj_description('pcm.agenda_tecnico'::regclass, 'pg_class')),
  'OBSOLETO desde E01-S202',
  'AC-7: a obsolescência está declarada no próprio schema, não só na spec'
);

select * from finish();
rollback;
