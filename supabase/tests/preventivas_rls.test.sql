-- preventivas_rls.test.sql — pgTAP (E01-S53 AC-1, AC-4, AC-7)
-- Roda no job db-tests. Esta máquina não possui Docker/Supabase local.

begin;
set local app.auvo_sync_write = 'true';
select plan(40);

select has_table('pcm', 'planos_preventivos', 'AC-1: planos existem');
select has_table('pcm', 'ocorrencias_preventivas', 'AC-1: ocorrências existem');
select has_column('pcm', 'ocorrencias_preventivas', 'origem', 'Ocorrência identifica origem legada');
select has_table('pcm', 'avaliacoes_preventivas', 'AC-5: avaliações existem');
select has_table('pcm', 'achados_preventivos', 'AC-6: achados existem');
select has_function(
  'pcm',
  'materializar_ocorrencias_preventivas',
  array['uuid', 'date'],
  'AC-1: materialização idempotente existe'
);
select has_function(
  'pcm',
  'atualizar_resultado_preventiva',
  array['uuid', 'text', 'timestamp with time zone'],
  'AC-5/AC-9: consolidação de resultado da ocorrência existe'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000531', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'preventiva-leitura-s53@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000532', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'preventiva-escrita-s53@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- auth.users é isolada do papel de aplicação service_role.
set local role service_role;
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

-- O usuário autenticado prova a escrita; a inspeção da trilha técnica é feita
-- pelo papel de infraestrutura, pois audit.events não é exposta ao cliente.
set local role service_role;
select is(
  (select count(*)::int from audit.events
    where entity = 'pcm.planos_preventivos'
      and entity_id = '00000000-0000-0000-0000-000000000537'::uuid
      and action = 'insert'),
  1,
  'AC-1: criação do plano deixa auditoria append-only'
);

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
reset role;
select is((select count(*)::int from pcm.ocorrencias_preventivas where plano_id = '00000000-0000-0000-0000-000000000537' and origem = 'legado'), 3, 'materialização existente classifica todos os ciclos como legado');
select throws_ok($$ update pcm.ocorrencias_preventivas set origem = 'rotina' where plano_id = '00000000-0000-0000-0000-000000000537' $$, '23514', null, 'origem nova permanece bloqueada até isolamento e compatibilidade');
select is((select count(*)::int from pcm.ocorrencias_preventivas o
  join pcm.planos_preventivos p on p.id = o.plano_id
  where p.id = '00000000-0000-0000-0000-000000000537'
    and o.vencimento is distinct from pcm.sso_vencimento_ciclo_calendario(p.primeira_data, p.intervalo_n, p.intervalo_unidade, o.indice)),
  0, 'cálculo novo coincide com ciclos semanais legados');
set local role service_role;
insert into pcm.planos_preventivos (id, cliente_id, sistema_id, questionario_id, tipo_tarefa_id, nome, primeira_data, intervalo_unidade, intervalo_n, estado, created_by)
values ('00000000-0000-0000-0000-000000000538', '00000000-0000-0000-0000-000000000533', '00000000-0000-0000-0000-000000000534', '00000000-0000-0000-0000-000000000535', '00000000-0000-0000-0000-000000000536', '[TESTE] Plano mensal S53', '2024-01-31', 'meses', 1, 'ativo', '00000000-0000-0000-0000-000000000532');
select is(pcm.materializar_ocorrencias_preventivas('00000000-0000-0000-0000-000000000538', '2024-04-30'), 4, 'materializa ciclos mensais legados com fim de mês');
reset role;
select is((select count(*)::int from pcm.ocorrencias_preventivas o
  join pcm.planos_preventivos p on p.id = o.plano_id
  where p.id = '00000000-0000-0000-0000-000000000538'
    and o.vencimento is distinct from pcm.sso_vencimento_ciclo_calendario(p.primeira_data, p.intervalo_n, p.intervalo_unidade, o.indice)),
  0, 'cálculo novo coincide com ciclos mensais legados');
set local role service_role;
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
select is(
  pcm.atualizar_resultado_preventiva(
    (select id from pcm.ocorrencias_preventivas where plano_id = '00000000-0000-0000-0000-000000000537' and indice = 0),
    'nao_ok',
    '2026-10-02T10:00:00Z'
  ),
  'nao_ok',
  'AC-5: ocorrência expõe resultado Não OK consolidado'
);
select is(
  pcm.atualizar_resultado_preventiva(
    (select id from pcm.ocorrencias_preventivas where plano_id = '00000000-0000-0000-0000-000000000537' and indice = 0),
    'ok',
    '2026-10-01T10:00:00Z'
  ),
  'nao_ok',
  'AC-5: atualização antiga não regride resultado consolidado'
);
select throws_ok(
  $$ insert into pcm.ocorrencias_preventivas (plano_id, indice, vencimento, chave_externa) values ('00000000-0000-0000-0000-000000000537', 0, current_date, 'PREV-DUPLICADA-S53') $$,
  '23505',
  null,
  'AC-4: ocorrência duplicada no mesmo ciclo é rejeitada'
);

reset role;
-- Simula futura origem em transação revertida: nenhuma linha nova é liberada em operação.
alter table pcm.ocorrencias_preventivas drop constraint ocorrencia_preventiva_origem_faseada;
insert into pcm.achados_preventivos(avaliacao_id, chave_origem, descricao)
select id, 'simulacao-nova-origem', 'Achado sintético' from pcm.avaliacoes_preventivas where chave_origem = 'teste-ordem-s53';
update pcm.ocorrencias_preventivas set origem = 'rotina' where plano_id = '00000000-0000-0000-0000-000000000537' and indice = 0;
insert into pcm.avaliacoes_preventivas(ocorrencia_id, chave_origem)
select id, 'avaliacao-legada' from pcm.ocorrencias_preventivas where plano_id = '00000000-0000-0000-0000-000000000537' and indice = 1;
insert into pcm.achados_preventivos(avaliacao_id, chave_origem, descricao)
select id, 'achado-legado', 'Achado legado sintético' from pcm.avaliacoes_preventivas where chave_origem = 'avaliacao-legada';
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
select throws_ok($$ insert into pcm.achados_preventivos(avaliacao_id, chave_origem, descricao) select id, 'achado-novo', 'Não autorizado' from pcm.avaliacoes_preventivas where chave_origem = 'teste-ordem-s53' $$, '23514', null, 'serviço legado não cria achado de outra origem');
select throws_ok($$ update pcm.achados_preventivos set descricao = 'Alteração indevida' where chave_origem = 'simulacao-nova-origem' $$, '23514', null, 'serviço legado não altera achado de outra origem');
select throws_ok($$ update pcm.achados_preventivos set avaliacao_id = (select id from pcm.avaliacoes_preventivas where chave_origem = 'avaliacao-legada') where chave_origem = 'simulacao-nova-origem' $$, '23514', null, 'achado de outra origem não é reclassificado como legado');
select throws_ok($$ update pcm.avaliacoes_preventivas set ocorrencia_id = (select id from pcm.ocorrencias_preventivas where plano_id = '00000000-0000-0000-0000-000000000537' and indice = 1) where chave_origem = 'teste-ordem-s53' $$, '23514', null, 'avaliação de outra origem não é reclassificada como legado');
select lives_ok($$ update pcm.achados_preventivos set descricao = 'Legado atualizado' where chave_origem = 'achado-legado' $$, 'serviço preserva atualização de achado legado');
select throws_ok($$ select pcm.upsert_avaliacoes_preventivas(jsonb_build_array(
  jsonb_build_object('ocorrencia_id', (select id from pcm.ocorrencias_preventivas where plano_id = '00000000-0000-0000-0000-000000000537' and indice = 1), 'chave_origem', 'lote-legado'),
  jsonb_build_object('ocorrencia_id', (select id from pcm.ocorrencias_preventivas where plano_id = '00000000-0000-0000-0000-000000000537' and indice = 0), 'chave_origem', 'lote-novo')
)) $$, '23514', null, 'importação legada recusa lote com origem nova');
select is((select count(*)::int from pcm.avaliacoes_preventivas where chave_origem in ('lote-legado', 'lote-novo')), 0, 'lote misto rejeitado não grava parcialmente');
select throws_ok($$ select pcm.atualizar_resultado_preventiva((select id from pcm.ocorrencias_preventivas where plano_id = '00000000-0000-0000-0000-000000000537' and indice = 0), 'ok', now()) $$, '23514', null, 'resultado legado recusa origem nova');
select throws_ok($$ select pcm.atualizar_resultado_preventiva((select id from pcm.ocorrencias_preventivas where plano_id = '00000000-0000-0000-0000-000000000537' and indice = 0), 'ok', '2020-01-01'::timestamptz) $$, '23514', null, 'evento antigo não consulta resultado de outra origem');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000531","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select is((select count(*)::int from pcm.avaliacoes_preventivas where chave_origem = 'avaliacao-legada'), 1, 'leitor PCM mantém acesso à avaliação legada');
select is((select count(*)::int from pcm.achados_preventivos where chave_origem = 'achado-legado'), 1, 'leitor PCM mantém acesso ao achado legado');
select is((select count(*)::int from pcm.ocorrencias_preventivas where plano_id = '00000000-0000-0000-0000-000000000537'), 2, 'permissão legada não mostra Ocorrência de origem nova');
select is((select count(*)::int from pcm.avaliacoes_preventivas where chave_origem = 'teste-ordem-s53'), 0, 'permissão legada não mostra avaliação da origem nova');
select is((select count(*)::int from pcm.achados_preventivos where chave_origem = 'simulacao-nova-origem'), 0, 'permissão legada não mostra achado da origem nova');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000532","user_role":"superadmin"}';
select is((select count(*)::int from pcm.ocorrencias_preventivas where plano_id = '00000000-0000-0000-0000-000000000537'), 2, 'superadmin não recebe origem nova pela política legada');
select is((select count(*)::int from pcm.avaliacoes_preventivas where chave_origem = 'teste-ordem-s53'), 0, 'política legada não libera avaliação nova a superadmin');
select is((select count(*)::int from pcm.achados_preventivos where chave_origem = 'simulacao-nova-origem'), 0, 'política legada não libera achado novo a superadmin');
reset role;
select * from finish();
rollback;
