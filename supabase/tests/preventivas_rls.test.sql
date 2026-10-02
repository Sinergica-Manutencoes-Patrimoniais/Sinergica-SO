-- preventivas_rls.test.sql — pgTAP (E01-S53 AC-1, AC-4, AC-7)
-- Roda no job db-tests. Esta máquina não possui Docker/Supabase local.

begin;
select plan(14);

select has_table('pcm', 'planos_preventivos', 'AC-1: planos existem');
select has_table('pcm', 'ocorrencias_preventivas', 'AC-1: ocorrências existem');
select has_table('pcm', 'avaliacoes_preventivas', 'AC-5: avaliações existem');
select has_table('pcm', 'achados_preventivos', 'AC-6: achados existem');
select has_function(
  'pcm',
  'materializar_ocorrencias_preventivas',
  array['uuid', 'date'],
  'AC-1: materialização idempotente existe'
);

set local role service_role;
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000531', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'preventiva-leitura-s53@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000532', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'preventiva-escrita-s53@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;
insert into pcm.clientes (id, nome, created_by, updated_by)
values ('00000000-0000-0000-0000-000000000533', '[TESTE] Cliente S53', '00000000-0000-0000-0000-000000000532', '00000000-0000-0000-0000-000000000532');
insert into pcm.sistemas (id, cliente_id, nome, created_by, updated_by)
values ('00000000-0000-0000-0000-000000000534', '00000000-0000-0000-0000-000000000533', '[TESTE] Sistema S53', '00000000-0000-0000-0000-000000000532', '00000000-0000-0000-0000-000000000532');
insert into pcm.questionarios (id, auvo_id, nome, ativo)
values ('00000000-0000-0000-0000-000000000535', 90535, '[TESTE] Questionário S53', true);
insert into pcm.tipos_tarefa (id, nome, auvo_id, created_by, updated_by)
values ('00000000-0000-0000-0000-000000000536', '[TESTE] Tipo S53', 90536, '00000000-0000-0000-0000-000000000532', '00000000-0000-0000-0000-000000000532');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000531","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select throws_ok(
  $$ insert into pcm.planos_preventivos (cliente_id, sistema_id, questionario_id, tipo_tarefa_id, nome, primeira_data, intervalo_unidade, intervalo_n, estado, created_by) values ('00000000-0000-0000-0000-000000000533', '00000000-0000-0000-0000-000000000534', '00000000-0000-0000-0000-000000000535', '00000000-0000-0000-0000-000000000536', '[TESTE] Plano leitura S53', current_date, 'semanas', 1, 'ativo', '00000000-0000-0000-0000-000000000531') $$,
  '42501',
  null,
  'AC-8: PCM leitura não cria plano'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000532","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.planos_preventivos (id, cliente_id, sistema_id, questionario_id, tipo_tarefa_id, nome, primeira_data, intervalo_unidade, intervalo_n, estado, created_by) values ('00000000-0000-0000-0000-000000000537', '00000000-0000-0000-0000-000000000533', '00000000-0000-0000-0000-000000000534', '00000000-0000-0000-0000-000000000535', '00000000-0000-0000-0000-000000000536', '[TESTE] Plano escrita S53', current_date, 'semanas', 1, 'ativo', '00000000-0000-0000-0000-000000000532') $$,
  'AC-1: PCM escrita cria plano com alvo do cliente'
);
select is(
  (select count(*)::int from audit.events
    where entity = 'pcm.planos_preventivos'
      and entity_id = '00000000-0000-0000-0000-000000000537'::uuid
      and action = 'insert'),
  1,
  'AC-1: criação do plano deixa auditoria append-only'
);

set local role service_role;
select is(
  pcm.materializar_ocorrencias_preventivas('00000000-0000-0000-0000-000000000537', current_date + 14),
  3,
  'AC-1: materializa três ciclos ancorados'
);
select is(
  pcm.materializar_ocorrencias_preventivas('00000000-0000-0000-0000-000000000537', current_date + 14),
  0,
  'AC-1: segunda materialização não duplica ciclos'
);
select is(
  pcm.upsert_avaliacoes_preventivas(jsonb_build_array(jsonb_build_object(
    'ocorrencia_id', (select id from pcm.ocorrencias_preventivas where plano_id = '00000000-0000-0000-0000-000000000537' and indice = 0),
    'chave_origem', 'teste-ordem-s53',
    'resposta', jsonb_build_object('valor', 'Resposta nova'),
    'auvo_updated_at', '2026-10-02T10:00:00Z',
    'recebido_em', '2026-10-02T10:01:00Z'
  ))),
  1,
  'AC-5: primeira resposta preventiva é registrada'
);
select is(
  pcm.upsert_avaliacoes_preventivas(jsonb_build_array(jsonb_build_object(
    'ocorrencia_id', (select id from pcm.ocorrencias_preventivas where plano_id = '00000000-0000-0000-0000-000000000537' and indice = 0),
    'chave_origem', 'teste-ordem-s53',
    'resposta', jsonb_build_object('valor', 'Resposta antiga'),
    'auvo_updated_at', '2026-10-01T10:00:00Z',
    'recebido_em', '2026-10-02T10:02:00Z'
  ))),
  0,
  'AC-5: evento Auvo antigo não atualiza avaliação'
);
select is(
  (select resposta ->> 'valor' from pcm.avaliacoes_preventivas where chave_origem = 'teste-ordem-s53'),
  'Resposta nova',
  'AC-5: resposta mais nova permanece após reentrega fora de ordem'
);
select throws_ok(
  $$ insert into pcm.ocorrencias_preventivas (plano_id, indice, vencimento, chave_externa) values ('00000000-0000-0000-0000-000000000537', 0, current_date, 'PREV-DUPLICADA-S53') $$,
  '23505',
  null,
  'AC-4: ocorrência duplicada no mesmo ciclo é rejeitada'
);

reset role;
select * from finish();
rollback;
