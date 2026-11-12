-- Caracterização do vínculo Chamado:OS. Os resultados não provam funcionamento 1:N completo.
-- Fixtures, alterações e auditoria são revertidas; não utiliza sequências nem chama Auvo.
--
-- Depois da migration 1842 (corte 1:1 -> 1:N) duas caracterizações mudaram de mecanismo, e as
-- asserções abaixo foram atualizadas pra refletir o estado real, não pra acomodar regressão:
--   - a 2ª OS ativa por Chamado continua recusada, mas por `23514
--     novo_vinculo_exige_comando_chamado_os` (guarda, 1499) em vez de `23505` (índice único);
--   - a dívida "vínculo legado aceita Cliente divergente" deixou de existir: a mesma guarda
--     compara `chamados.cliente_id` com `ordens_servico.client_id` e recusa com
--     `23514 chamado_ou_cliente_invalido`.
begin;
set local app.auvo_sync_write = 'true';
select plan(13);
insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('16700000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'caracterizacao-s167@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into pcm.clientes(id, nome, created_by) values
 ('16700000-0000-0000-0000-00000000000a', 'Cliente A S167', '16700000-0000-0000-0000-000000000001'),
 ('16700000-0000-0000-0000-00000000000b', 'Cliente B S167', '16700000-0000-0000-0000-000000000001');
insert into pcm.chamados(id, numero, cliente_id, titulo, created_by) values
 ('16700000-0000-0000-0000-000000000011', 'CH-TESTE-S167-A', '16700000-0000-0000-0000-00000000000a', 'Chamado A', '16700000-0000-0000-0000-000000000001'),
 ('16700000-0000-0000-0000-000000000012', 'CH-TESTE-S167-B', '16700000-0000-0000-0000-00000000000b', 'Chamado B', '16700000-0000-0000-0000-000000000001'),
 ('16700000-0000-0000-0000-000000000013', 'CH-TESTE-S167-C', '16700000-0000-0000-0000-00000000000a', 'Chamado C', '16700000-0000-0000-0000-000000000001');
insert into pcm.ordens_servico(id, client_id, numero, titulo, categoria, created_by, chamado_id) values
 ('16700000-0000-0000-0000-000000000021', '16700000-0000-0000-0000-00000000000a', 'IGNORADO-A', 'OS A', 'corretiva', '16700000-0000-0000-0000-000000000001', '16700000-0000-0000-0000-000000000011'),
 ('16700000-0000-0000-0000-000000000022', '16700000-0000-0000-0000-00000000000b', 'IGNORADO-B', 'OS B', 'corretiva', '16700000-0000-0000-0000-000000000001', '16700000-0000-0000-0000-000000000012');
update pcm.chamados set ordem_servico_id = '16700000-0000-0000-0000-000000000021' where id = '16700000-0000-0000-0000-000000000011';
select is((select chamado_id from pcm.ordens_servico where id = '16700000-0000-0000-0000-000000000021'), '16700000-0000-0000-0000-000000000011'::uuid, 'OS preserva vínculo canônico e UUID');
select is((select ordem_servico_id from pcm.chamados where id = '16700000-0000-0000-0000-000000000011'), '16700000-0000-0000-0000-000000000021'::uuid, 'vínculo singular legado pode apontar à OS existente');
select is((select numero from pcm.ordens_servico where id = '16700000-0000-0000-0000-000000000021'), 'CH-TESTE-S167-A', 'trigger preserva número de Chamado na primeira OS');
select throws_ok($$insert into pcm.ordens_servico(id, client_id, numero, titulo, categoria, created_by, chamado_id) values ('16700000-0000-0000-0000-000000000023', '16700000-0000-0000-0000-00000000000a', 'OS-SEGUNDA', 'Segunda OS', 'corretiva', '16700000-0000-0000-0000-000000000001', '16700000-0000-0000-0000-000000000011')$$, '23514', 'novo_vinculo_exige_comando_chamado_os', 'segunda OS ativa por Chamado segue recusada, agora pela guarda');
update pcm.ordens_servico set deleted_at = now() where id = '16700000-0000-0000-0000-000000000021';
select throws_ok($$insert into pcm.ordens_servico(id, client_id, numero, titulo, categoria, created_by, chamado_id) values ('16700000-0000-0000-0000-000000000023', '16700000-0000-0000-0000-00000000000a', 'OS-SEGUNDA', 'Segunda OS', 'corretiva', '16700000-0000-0000-0000-000000000001', '16700000-0000-0000-0000-000000000011')$$, '23505', null, 'número legado continua único mesmo após exclusão lógica');
select is((select ordem_servico_id from pcm.chamados where id = '16700000-0000-0000-0000-000000000011'), '16700000-0000-0000-0000-000000000021'::uuid, 'exclusão lógica não apaga referência histórica');
-- Chamado C é do Cliente A; a OS abaixo tenta nascer no Cliente B. Era a dívida do legado (o
-- índice único só olhava `chamado_id`); a guarda de 1499 passou a cobrir isso no corte da 1842.
select throws_ok($$insert into pcm.ordens_servico(id, client_id, numero, titulo, categoria, created_by, chamado_id) values ('16700000-0000-0000-0000-000000000024', '16700000-0000-0000-0000-00000000000b', 'IGNORADO-C', 'OS Cliente divergente', 'corretiva', '16700000-0000-0000-0000-000000000001', '16700000-0000-0000-0000-000000000013')$$, '23514', 'chamado_ou_cliente_invalido', 'vínculo com Cliente divergente do Chamado é recusado');
select is((select count(*)::int from pcm.ordens_servico os join pcm.chamados ch on ch.id = os.chamado_id where os.client_id <> ch.cliente_id), 0, 'nenhum vínculo Chamado:OS com Cliente divergente sobrevive');
set local role authenticated;
set local request.jwt.claims = '{"sub":"16700000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select is((select count(*)::int from pcm.chamados where id in ('16700000-0000-0000-0000-000000000011','16700000-0000-0000-0000-000000000012')), 2, 'dívida: leitura PCM legada não filtra Cliente');
select throws_ok($$insert into pcm.chamados(id, numero, cliente_id, titulo, created_by) values ('16700000-0000-0000-0000-000000000014', 'CH-TESTE-S167-D', '16700000-0000-0000-0000-00000000000a', 'Não autorizado', '16700000-0000-0000-0000-000000000001')$$, '42501', null, 'leitor não cria Chamado');
set local request.jwt.claims = '{"sub":"16700000-0000-0000-0000-000000000001","role":"authenticated","user_role":"cliente-sindico","cliente_id":"16700000-0000-0000-0000-00000000000a"}';
select is((select count(*)::int from pcm.chamados where id in ('16700000-0000-0000-0000-000000000011','16700000-0000-0000-0000-000000000012')), 1, 'ramo Cliente-síndico filtra Chamado pelo Cliente presente no claim');
reset role;
select is((select count(*)::int from pcm.auvo_sync_outbox where row_id in ('16700000-0000-0000-0000-000000000021','16700000-0000-0000-0000-000000000022','16700000-0000-0000-0000-000000000024')), 0, 'fixture não gera intenção Auvo');
select is((select numero from pcm.chamados where id = '16700000-0000-0000-0000-000000000011'), 'CH-TESTE-S167-A', 'operações preservam número original do Chamado');
select * from finish();
rollback;
