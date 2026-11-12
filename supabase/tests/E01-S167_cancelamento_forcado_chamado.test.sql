-- E01-S167 AC-6 (segunda metade): cancelamento não conservador — cancela Chamado com escopo
-- pendente, cascateando pra OS ainda abertas (preservando histórico, nunca deletando). Recusa se
-- alguma OS vinculada já tem efeito remoto (auvo_task_id/auvo_sync_status) — mesmo padrão de
-- "exige reconciliação" já usado em E01-S171 (sso_transicionar_visita_preparada).
begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('16770000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's167-cancforcado@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('16770000-0000-4000-8000-000000000001', 'superadmin', 'S167 Canc Forçado', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('16770000-0000-4000-8000-000000000002', 'Cliente S167 Canc Forçado', true, '16770000-0000-4000-8000-000000000001'),
 ('16770000-0000-4000-8000-000000000003', 'Cliente Divergente Canc Forçado', true, '16770000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('16770000-0000-4000-8000-000000000001', 'chamado.encerrar', '16770000-0000-4000-8000-000000000002'),
 ('16770000-0000-4000-8000-000000000001', 'chamado.escopo.gerir', '16770000-0000-4000-8000-000000000002');
insert into pcm.sistemas (id, cliente_id, nome) values ('16770000-0000-4000-8000-000000000099', '16770000-0000-4000-8000-000000000002', 'Sistema Canc Forçado');

-- Chamado A: tem OS aberta com efeito remoto (auvo_task_id) — bloqueia o cancelamento inteiro.
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('16770000-0000-4000-8000-000000000011', 'CH-CANCFORC-A', '16770000-0000-4000-8000-000000000002', 'Chamado com efeito remoto', '16770000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, auvo_task_id, created_by) values
 ('16770000-0000-4000-8000-000000000012', '16770000-0000-4000-8000-000000000002', '16770000-0000-4000-8000-000000000011', 'OS-CANCFORC-REMOTA', 'OS com Auvo', 'corretiva', 'solicitacao', 918273, '16770000-0000-4000-8000-000000000001');

-- Chamado B: OS aberta sem efeito remoto + OS já finalizada + parcela pendente — cenário de sucesso.
-- Duas OS pro mesmo Chamado: até a migration 1842 isso exigia simular o corte 1:1 -> 1:N aqui
-- dentro (drop do índice legado e da trigger de numeração legada, que sobrescrevia `numero` com o
-- do Chamado e colidiria na segunda OS). O corte agora faz parte do schema; a numeração vem de
-- `pcm.sso_numero_os_chamado_compativel()` (1500), que com token de comando gera
-- `<numero-do-chamado>-OS-<uuid>`. O `numero` da fixture é rótulo de leitura, nunca asserido.
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('16770000-0000-4000-8000-000000000016', 'CH-CANCFORC-B', '16770000-0000-4000-8000-000000000002', 'Chamado cancelamento forçado', '16770000-0000-4000-8000-000000000001');
-- `sso_guardar_novo_vinculo_chamado_os` (1499) só permite a segunda OS do mesmo Chamado via o
-- token de comando real (`pcm.sso_criar_os_chamado`); fixture crua precisa fornecer o mesmo token.
set local request.jwt.claims = '{"sub":"16770000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
insert into pcm.sso_guarda_multiplas_os_tokens (txid, ator_id, chamado_id, cliente_id, os_id) values
 (pg_catalog.txid_current(), '16770000-0000-4000-8000-000000000001', '16770000-0000-4000-8000-000000000016', '16770000-0000-4000-8000-000000000002', '16770000-0000-4000-8000-000000000017'),
 (pg_catalog.txid_current(), '16770000-0000-4000-8000-000000000001', '16770000-0000-4000-8000-000000000016', '16770000-0000-4000-8000-000000000002', '16770000-0000-4000-8000-000000000018');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, created_by) values
 ('16770000-0000-4000-8000-000000000017', '16770000-0000-4000-8000-000000000002', '16770000-0000-4000-8000-000000000016', 'OS-CANCFORC-ABERTA', 'OS aberta', 'corretiva', 'solicitacao', '16770000-0000-4000-8000-000000000001'),
 ('16770000-0000-4000-8000-000000000018', '16770000-0000-4000-8000-000000000002', '16770000-0000-4000-8000-000000000016', 'OS-CANCFORC-FINAL', 'OS já finalizada', 'corretiva', 'finalizado', '16770000-0000-4000-8000-000000000001');
insert into pcm.chamado_escopo_parcelas (id, chamado_id, descricao, situacao, created_by) values
 ('16770000-0000-4000-8000-000000000021', '16770000-0000-4000-8000-000000000016', 'Parcela pendente canc. forçado', 'pendente', '16770000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claims = '{"sub":"16770000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

select throws_ok($$ select pcm.sso_cancelar_chamado_forcado(gen_random_uuid(),'16770000-0000-4000-8000-000000000002','16770000-0000-4000-8000-000000000011',1,'teste') $$, '55000', null, 'gate fechado por padrão recusa o cancelamento forçado');

reset role;
update pcm.sso_cancelamento_forcado_chamado_gate set habilitado = true where id;
update pcm.sso_devolucao_escopo_backlog_gate set habilitado = true where id;
set local role authenticated;
set local request.jwt.claims = '{"sub":"16770000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

select throws_ok($$ select pcm.sso_cancelar_chamado_forcado(gen_random_uuid(),'16770000-0000-4000-8000-000000000003','16770000-0000-4000-8000-000000000011',1,'teste') $$, '42501', null, 'Cliente divergente é negado');

select throws_ok($$ select pcm.sso_cancelar_chamado_forcado(gen_random_uuid(),'16770000-0000-4000-8000-000000000002','16770000-0000-4000-8000-000000000011',1,'teste') $$, '23514', 'efeito_remoto_exige_reconciliacao', 'OS com auvo_task_id bloqueia o cancelamento forçado inteiro');

select throws_ok($$ select pcm.sso_cancelar_chamado_forcado(gen_random_uuid(),'16770000-0000-4000-8000-000000000002','16770000-0000-4000-8000-000000000016',2,'teste') $$, '40001', 'revisao_obsoleta', 'revisão divergente é recusada');

select (pcm.sso_cancelar_chamado_forcado('16770000-0000-4000-8000-000000000031','16770000-0000-4000-8000-000000000002','16770000-0000-4000-8000-000000000016',1,'escopo não resolvido, cancelamento forçado')->>'revision') as rev_pos_cancelamento \gset

select ok(:'rev_pos_cancelamento' is not null, 'cancelamento forçado com OS sem efeito remoto é aceito');

reset role;
select is((select status from pcm.chamados where id = '16770000-0000-4000-8000-000000000016'), 'cancelado', 'chamado B fica cancelado');
select is((select status from pcm.ordens_servico where id = '16770000-0000-4000-8000-000000000017'), 'cancelado', 'OS aberta vinculada é cancelada junto, nunca deletada (continua existindo)');
select is((select status from pcm.ordens_servico where id = '16770000-0000-4000-8000-000000000018'), 'finalizado', 'OS já finalizada não é tocada pelo cancelamento forçado');
set local role authenticated;
set local request.jwt.claims = '{"sub":"16770000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

select is(
  (pcm.sso_cancelar_chamado_forcado('16770000-0000-4000-8000-000000000031','16770000-0000-4000-8000-000000000002','16770000-0000-4000-8000-000000000016',1,'escopo não resolvido, cancelamento forçado')->>'revision'),
  :'rev_pos_cancelamento', 'replay do mesmo request_id devolve a mesma resposta, sem cancelar de novo'
);

-- Fecha o ciclo: com o Chamado já cancelado (não só suspenso), a devolução da parcela pendente ao
-- Backlog (1830, alargada nesta migration) continua funcionando sem precisar de suspensão.
select ok(
  (pcm.sso_devolver_parcela_chamado_backlog(gen_random_uuid(),'16770000-0000-4000-8000-000000000002','16770000-0000-4000-8000-000000000016','16770000-0000-4000-8000-000000000021','sistema','16770000-0000-4000-8000-000000000099','devolução após cancelamento forçado')->>'backlogParcelaId') is not null,
  'devolução de parcela funciona com Chamado cancelado, não só suspenso'
);

select * from finish();
rollback;
