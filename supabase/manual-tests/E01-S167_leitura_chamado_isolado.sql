-- Executar somente em banco descartável: DDL de fixture é revertido no rollback.
-- Em psql, -v with_migration=1 aplica 0312 na própria transação de teste.
begin;
set local app.auvo_sync_write = 'true';
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
\if :{?with_migration}
\ir ../migrations/0312_E01-S167_leitura_ordens_chamado.sql
\endif
select plan(23);
insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('16710000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leitura-s167@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios(user_id, papel, nome, ativo) values ('16710000-0000-0000-0000-000000000001', 'colaborador', 'Gestor S167', true);
insert into config.usuario_modulos(user_id, modulo, nivel) values ('16710000-0000-0000-0000-000000000001', 'pcm', 'escrita');
insert into pcm.clientes(id, nome, created_by) values
 ('16710000-0000-0000-0000-00000000000a', 'Cliente A', '16710000-0000-0000-0000-000000000001'),
 ('16710000-0000-0000-0000-00000000000b', 'Cliente B', '16710000-0000-0000-0000-000000000001');
insert into pcm.chamados(id, numero, cliente_id, titulo, created_by) values
 ('16710000-0000-0000-0000-000000000011', 'CH-167100-A', '16710000-0000-0000-0000-00000000000a', 'Chamado A', '16710000-0000-0000-0000-000000000001'),
 ('16710000-0000-0000-0000-000000000012', 'CH-167100-B', '16710000-0000-0000-0000-00000000000b', 'Chamado B', '16710000-0000-0000-0000-000000000001'),
 ('16710000-0000-0000-0000-000000000013', 'CH-167100-C', '16710000-0000-0000-0000-00000000000a', 'Chamado unilateral', '16710000-0000-0000-0000-000000000001'),
 ('16710000-0000-0000-0000-000000000014', 'CH-167100-D', '16710000-0000-0000-0000-00000000000a', 'Chamado inconsistente', '16710000-0000-0000-0000-000000000001');
-- Simula cenário pós-migração 1:N sem liberar escritor ou modificar schema fora do teste.
drop index pcm.uq_ordens_servico_chamado;
alter table pcm.ordens_servico disable trigger trg_ordens_servico_numero_chamado;
insert into pcm.ordens_servico(id, client_id, numero, titulo, categoria, created_by, chamado_id) values
 ('16710000-0000-0000-0000-000000000021', '16710000-0000-0000-0000-00000000000a', 'OS-167100-1', 'OS A1', 'corretiva', '16710000-0000-0000-0000-000000000001', '16710000-0000-0000-0000-000000000011'),
 ('16710000-0000-0000-0000-000000000022', '16710000-0000-0000-0000-00000000000a', 'OS-167100-2', 'OS A2', 'corretiva', '16710000-0000-0000-0000-000000000001', '16710000-0000-0000-0000-000000000011'),
 ('16710000-0000-0000-0000-000000000023', '16710000-0000-0000-0000-00000000000b', 'OS-167100-3', 'OS divergente', 'corretiva', '16710000-0000-0000-0000-000000000001', '16710000-0000-0000-0000-000000000011'),
 ('16710000-0000-0000-0000-000000000024', '16710000-0000-0000-0000-00000000000a', 'OS-167100-4', 'OS unilateral', 'corretiva', '16710000-0000-0000-0000-000000000001', null);
update pcm.chamados set ordem_servico_id = '16710000-0000-0000-0000-000000000024' where id = '16710000-0000-0000-0000-000000000013';
set local role authenticated;
set local request.jwt.claims = '{"sub":"16710000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select throws_ok($$select * from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000011', 10, null)$$, '42501', null, 'módulo sem concessão não consulta');
select ok(not has_function_privilege('anon', 'pcm.sso_listar_ordens_chamado(uuid,uuid,integer,uuid)', 'execute'), 'anon não pode executar a consulta');
reset role;
insert into config.sso_concessoes(usuario_id, acao, cliente_id) values ('16710000-0000-0000-0000-000000000001', 'chamado.encerrar', '16710000-0000-0000-0000-00000000000a');
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000011', 10, null)$$, '23514', null, 'vínculo canônico divergente é sinalizado sem retornar dados');
reset role;
update pcm.ordens_servico set chamado_id = null where id = '16710000-0000-0000-0000-000000000023';
set local role authenticated;
select results_eq($$select id from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000011', 10, null)$$, $$values ('16710000-0000-0000-0000-000000000021'::uuid), ('16710000-0000-0000-0000-000000000022'::uuid)$$, 'duas OS do Cliente são retornadas');
select results_eq($$select id from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000011', 1, null)$$, $$values ('16710000-0000-0000-0000-000000000021'::uuid)$$, 'primeira página respeita limite');
select results_eq($$select id from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000011', 1, '16710000-0000-0000-0000-000000000021')$$, $$values ('16710000-0000-0000-0000-000000000022'::uuid)$$, 'cursor recupera próxima OS sem duplicar');
select is((select count(*)::int from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000011', 1, '16710000-0000-0000-0000-000000000022')), 0, 'página depois da última OS está vazia');
select results_eq($$select id from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000013', 10, null)$$, $$values ('16710000-0000-0000-0000-000000000024'::uuid)$$, 'referência unilateral do mesmo Cliente não é omitida');
reset role;
update pcm.chamados set ordem_servico_id = '16710000-0000-0000-0000-000000000021' where id = '16710000-0000-0000-0000-000000000014';
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000011', 10, null)$$, '23514', null, 'OS canônica com referência singular de outro Chamado é ambígua mesmo sem referência no Chamado consultado');
select throws_ok($$select * from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000014', 10, null)$$, '23514', null, 'referência singular que aponta OS de outro Chamado é rejeitada');
select throws_ok($$select * from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000012', 10, null)$$, '42501', null, 'Chamado de outro Cliente não é consultado');
select throws_ok($$select * from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000b', '16710000-0000-0000-0000-000000000012', 10, null)$$, '42501', null, 'sem concessão no Cliente B não consulta');
select throws_ok($$select * from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000011', 101, null)$$, '22023', null, 'limite excessivo é rejeitado');
select throws_ok($$select * from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000011', 0, null)$$, '22023', null, 'limite zero é rejeitado');
select throws_ok($$select * from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000011', null, null)$$, '22023', null, 'limite nulo é rejeitado');
select throws_ok($$select * from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000099', 10, null)$$, '42501', null, 'Chamado inexistente tem o mesmo erro de falta de acesso');
reset role;
update pcm.chamados set ordem_servico_id = '16710000-0000-0000-0000-000000000023' where id = '16710000-0000-0000-0000-000000000014';
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000014', 10, null)$$, '23514', null, 'referência singular para OS de outro Cliente é rejeitada');
reset role;
update pcm.chamados set ordem_servico_id = null where id = '16710000-0000-0000-0000-000000000014';
update pcm.chamados set ordem_servico_id = '16710000-0000-0000-0000-000000000021' where id = '16710000-0000-0000-0000-000000000011';
set local role authenticated;
select is((select count(*)::int from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000011', 10, null)), 2, 'vínculo bidirecional não duplica OS');
reset role;
update pcm.chamados set ordem_servico_id = '16710000-0000-0000-0000-000000000021' where id = '16710000-0000-0000-0000-000000000014';
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000011', 10, null)$$, '23514', null, 'referência singular compartilhada é sinalizada como ambígua');
reset role;
update config.sso_concessoes set ativa = false where usuario_id = '16710000-0000-0000-0000-000000000001' and acao = 'chamado.encerrar';
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000011', 10, null)$$, '42501', null, 'revogação vale com token antigo');
reset role;
update config.sso_concessoes set ativa = true where usuario_id = '16710000-0000-0000-0000-000000000001' and acao = 'chamado.encerrar';
update config.usuarios set ativo = false where user_id = '16710000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000011', 10, null)$$, '42501', null, 'usuário inativado não consulta com token antigo');
reset role;
update config.usuarios set ativo = true, papel = 'cliente-sindico' where user_id = '16710000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_ordens_chamado('16710000-0000-0000-0000-00000000000a', '16710000-0000-0000-0000-000000000011', 10, null)$$, '42501', null, 'mudança de papel invalida leitura com token antigo');
reset role;
select is((select count(*)::int from pcm.auvo_sync_outbox where row_id in ('16710000-0000-0000-0000-000000000021','16710000-0000-0000-0000-000000000022','16710000-0000-0000-0000-000000000023')), 0, 'consulta e fixtures não geram intenção Auvo');
select * from finish();
rollback;
