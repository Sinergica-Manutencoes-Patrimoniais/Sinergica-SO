-- S165 AC-7: transição e retomada mantêm histórico, sem materializar vencidos.
-- O gate é aberto somente dentro desta transação de teste; nenhum Auvo é chamado.
begin;
set local timezone = 'America/Sao_Paulo';
set local app.auvo_sync_write = 'true';
select plan(21);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at) values
  ('16582000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gestor-transicao-s165@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios(user_id, papel, nome, ativo)
  values ('16582000-0000-4000-8000-000000000001', 'superadmin', 'Gestor de transição S165', true);
insert into pcm.clientes(id, nome, ativo, created_by)
  values ('16582000-0000-4000-8000-00000000000a', 'Cliente transição S165', true, '16582000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id, acao, cliente_id)
  values ('16582000-0000-4000-8000-000000000001', 'plano.gerir', '16582000-0000-4000-8000-00000000000a');
insert into pcm.sistemas(id, cliente_id, nome)
  values ('16582000-0000-4000-8000-000000000051', '16582000-0000-4000-8000-00000000000a', 'Sistema S165');

set local request.jwt.claims = '{"sub":"16582000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select lives_ok($$ select pcm.sso_salvar_plano_rascunho('16582000-0000-4000-8000-000000000101', 0,
  '16582000-0000-4000-8000-000000000011', '16582000-0000-4000-8000-00000000000a', 'Plano S165 transição') $$,
  'gestor cria plano para suspensão');
select lives_ok($$ select pcm.sso_adicionar_rotina_rascunho_v2('16582000-0000-4000-8000-000000000102', 1,
  '16582000-0000-4000-8000-000000000011', '16582000-0000-4000-8000-000000000031', 'Rotina S165', 'sistema',
  '16582000-0000-4000-8000-000000000051', 'calendario', 1, 'meses', current_date, 30, 0, 0,
  'Inspecionar', null, 'total') $$, 'gestor adiciona rotina com instrução e recorrência válidas');
select lives_ok($$ select pcm.sso_transicionar_revisao_plano('16582000-0000-4000-8000-000000000103', 2,
  '16582000-0000-4000-8000-000000000011', 'submeter') $$, 'gestor submete plano');
select lives_ok($$ select pcm.sso_aprovar_plano('16582000-0000-4000-8000-000000000104', 3,
  '16582000-0000-4000-8000-000000000011', current_date) $$, 'criador autorizado aprova plano');
select throws_ok($$ select pcm.sso_transicao_plano_mediada('16582000-0000-4000-8000-000000000001',
  '16582000-0000-4000-8000-00000000000a', '16582000-0000-4000-8000-000000000105',
  '16582000-0000-4000-8000-000000000011', 4, 'suspender', current_date, 'Pausa preventiva') $$,
  '55000', null, 'suspensão fica bloqueada enquanto gate está fechado');
reset role;

update pcm.plano_transicao_gate set habilitado = true where id;
update pcm.sso_guarda_geracao_plano_gate set habilitado = true where id;
insert into pcm.ocorrencias_rotina_preparadas(id, plano_id, versao_id, rotina_id, rotina_logica_id,
  alvo_tipo, alvo_id, ciclo, vencimento_original, tolerancia_antes, tolerancia_depois, created_by)
select '16582000-0000-4000-8000-000000000061', p.id, v.id, r.id, r.rotina_logica_id,
  r.alvo_tipo, r.sistema_id, 1, current_date + 1, 0, 0, '16582000-0000-4000-8000-000000000001'
from pcm.planos_manutencao p
join pcm.plano_versoes v on v.plano_id = p.id and v.estado = 'aprovado'
join pcm.rotinas_manutencao r on r.versao_id = v.id
where p.id = '16582000-0000-4000-8000-000000000011';

set local role authenticated;
select lives_ok($$ select pcm.sso_transicao_plano_mediada('16582000-0000-4000-8000-000000000001',
  '16582000-0000-4000-8000-00000000000a', '16582000-0000-4000-8000-000000000105',
  '16582000-0000-4000-8000-000000000011', 4, 'suspender', current_date, 'Pausa preventiva') $$,
  'gestor suspende plano com vigência e motivo');
reset role;
select is((select estado from pcm.planos_manutencao where id = '16582000-0000-4000-8000-000000000011'),
  'suspenso', 'estado do plano muda para suspenso');
select is((pcm.sso_transicao_plano_mediada('16582000-0000-4000-8000-000000000001',
  '16582000-0000-4000-8000-00000000000a', '16582000-0000-4000-8000-000000000105',
  '16582000-0000-4000-8000-000000000011', 4, 'suspender', current_date, 'Pausa preventiva')->>'revision')::integer,
  5, 'retry devolve recibo original sem nova revisão');
select is((select count(*)::integer from pcm.plano_transicoes_historico
  where plano_id = '16582000-0000-4000-8000-000000000011'), 1, 'suspensão grava um evento imutável');
select throws_ok($$ insert into pcm.ocorrencias_rotina_preparadas(id, plano_id, versao_id, rotina_id,
  rotina_logica_id, alvo_tipo, alvo_id, ciclo, vencimento_original, tolerancia_antes, tolerancia_depois, created_by)
select '16582000-0000-4000-8000-000000000062', p.id, v.id, r.id, r.rotina_logica_id,
  r.alvo_tipo, r.sistema_id, 2, current_date + 2, 0, 0, '16582000-0000-4000-8000-000000000001'
from pcm.planos_manutencao p join pcm.plano_versoes v on v.plano_id = p.id and v.estado = 'aprovado'
join pcm.rotinas_manutencao r on r.versao_id = v.id where p.id = '16582000-0000-4000-8000-000000000011' $$,
  '23514', null, 'guarda de geração recusa nova ocorrência enquanto suspenso');
select is((select count(*)::integer from pcm.ocorrencias_rotina_preparadas
  where plano_id = '16582000-0000-4000-8000-000000000011'), 1,
  'suspensão preserva ocorrência preparada e não cria outra');
select ok((pcm.sso_transicao_plano_mediada('16582000-0000-4000-8000-000000000001',
  '16582000-0000-4000-8000-00000000000a', '16582000-0000-4000-8000-000000000105',
  '16582000-0000-4000-8000-000000000011', 4, 'suspender', current_date, 'Pausa preventiva')->'warnings'
  @> '["geradores_legados_exigem_reconciliacao"]'::jsonb),
  'recibo explicita que geradores legados ainda exigem reconciliação');

set local role authenticated;
select lives_ok($$ select pcm.sso_transicao_plano_mediada('16582000-0000-4000-8000-000000000001',
  '16582000-0000-4000-8000-00000000000a', '16582000-0000-4000-8000-000000000106',
  '16582000-0000-4000-8000-000000000011', 5, 'retomar', current_date, 'Retomada conferida') $$,
  'gestor retoma plano e deixa vencidos para decisão do PCM');
reset role;
select is((select estado from pcm.planos_manutencao where id = '16582000-0000-4000-8000-000000000011'),
  'aprovado', 'retomada restaura estado anterior');
select ok((pcm.sso_transicao_plano_mediada('16582000-0000-4000-8000-000000000001',
  '16582000-0000-4000-8000-00000000000a', '16582000-0000-4000-8000-000000000106',
  '16582000-0000-4000-8000-000000000011', 5, 'retomar', current_date, 'Retomada conferida')->'warnings'
  @> '["vencidos_dependem_decisao_pcm"]'::jsonb),
  'retomada não avança vencimentos automaticamente');
select is((select count(*)::integer from pcm.plano_transicoes_historico
  where plano_id = '16582000-0000-4000-8000-000000000011'), 2, 'retomada preserva e acrescenta histórico');
select is((select count(*)::integer from pcm.ocorrencias_rotina_preparadas
  where plano_id = '16582000-0000-4000-8000-000000000011'), 1,
  'retomada não materializa vencidos retroativamente');
select lives_ok($$ insert into pcm.ocorrencias_rotina_preparadas(id, plano_id, versao_id, rotina_id,
  rotina_logica_id, alvo_tipo, alvo_id, ciclo, vencimento_original, tolerancia_antes, tolerancia_depois, created_by)
select '16582000-0000-4000-8000-000000000063', p.id, v.id, r.id, r.rotina_logica_id,
  r.alvo_tipo, r.sistema_id, 2, current_date + 3, 0, 0, '16582000-0000-4000-8000-000000000001'
from pcm.planos_manutencao p join pcm.plano_versoes v on v.plano_id = p.id and v.estado = 'aprovado'
join pcm.rotinas_manutencao r on r.versao_id = v.id where p.id = '16582000-0000-4000-8000-000000000011' $$,
  'guarda permite ocorrência futura após retomada');
select is((select count(*)::integer from pcm.ocorrencias_rotina_preparadas
  where plano_id = '16582000-0000-4000-8000-000000000011'), 2,
  'ocorrência futura após retomada permanece separada da vencida');
select throws_ok($$ delete from pcm.plano_transicoes_historico
  where plano_id = '16582000-0000-4000-8000-000000000011' $$,
  '23514', null, 'histórico de transições não pode ser apagado');
select is((select count(*)::integer from audit.events where entity_id = '16582000-0000-4000-8000-000000000011'
  and action in ('plano.suspender', 'plano.retomar')), 2, 'suspensão e retomada são auditadas');
reset role;
select * from finish();
rollback;
