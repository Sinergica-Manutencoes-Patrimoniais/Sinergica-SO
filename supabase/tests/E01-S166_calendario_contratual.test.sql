-- Fundação isolada, fixtures sintéticas e sem integração externa.
begin;
set local app.auvo_sync_write = 'true';
select plan(41);
insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('16600000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gestor-s166@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('16600000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'negado-s166@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios(user_id, papel, nome, ativo) values
 ('16600000-0000-0000-0000-000000000001', 'superadmin', 'Gestor S166', true),
 ('16600000-0000-0000-0000-000000000002', 'superadmin', 'Negado S166', true);
insert into pcm.clientes(id, nome, ativo, created_by) values
 ('16600000-0000-0000-0000-00000000000a', 'Cliente A S166', true, '16600000-0000-0000-0000-000000000001'),
 ('16600000-0000-0000-0000-00000000000b', 'Cliente B S166', true, '16600000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id, acao, cliente_id) values ('16600000-0000-0000-0000-000000000001', 'plano.gerir', '16600000-0000-0000-0000-00000000000a');
insert into comercial.etapas_funil(id, nome, ordem, cor) values ('16600000-0000-0000-0000-000000000021', 'Etapa S166', 1, '#000');
insert into comercial.oportunidades(id, cliente_id, etapa_id, titulo) values ('16600000-0000-0000-0000-000000000031', '16600000-0000-0000-0000-00000000000a', '16600000-0000-0000-0000-000000000021', 'Oportunidade S166');
insert into comercial.propostas(id, oportunidade_id, tipo) values ('16600000-0000-0000-0000-000000000041', '16600000-0000-0000-0000-000000000031', 'volante');
insert into comercial.contratos(id, proposta_id, cliente_id, tipo, vigencia_inicio) values ('16600000-0000-0000-0000-000000000051', '16600000-0000-0000-0000-000000000041', '16600000-0000-0000-0000-00000000000a', 'volante', '2026-01-01');
create temporary table s166_baseline as select (select count(*) from pcm.ocorrencias_preventivas) ocorrencias, (select count(*) from pcm.auvo_sync_outbox) outbox;
select has_table('pcm', 'calendario_contratual_series', 'série contratual existe');
select has_table('pcm', 'regras_visita_contratual', 'versões contratuais existem');
select lives_ok($$ insert into pcm.calendario_contratual_series(id, cliente_id, contrato_id, created_by) values ('16600000-0000-0000-0000-000000000061', '16600000-0000-0000-0000-00000000000a', '16600000-0000-0000-0000-000000000051', '16600000-0000-0000-0000-000000000001') $$, 'série vincula contrato ao Cliente correto');
select throws_ok($$ insert into pcm.calendario_contratual_series(id, cliente_id, contrato_id, created_by) values ('16600000-0000-0000-0000-000000000062', '16600000-0000-0000-0000-00000000000b', '16600000-0000-0000-0000-000000000051', '16600000-0000-0000-0000-000000000001') $$, '23503', null, 'contrato não é associado a outro Cliente');
select lives_ok($$ insert into pcm.regras_visita_contratual(id, serie_id, numero, ancora_semana, dia_semana, intervalo_semanas, hora_inicio, duracao_minutos, deslocamento_minutos, fuso, vigencia_inicio, vigencia_fim, created_by) values ('16600000-0000-0000-0000-000000000071', '16600000-0000-0000-0000-000000000061', 1, '2026-10-05', 5, 1, '08:00', 120, 30, 'America/Sao_Paulo', '2026-10-01', '2026-10-31', '16600000-0000-0000-0000-000000000001') $$, 'primeira regra válida');
select throws_ok($$ insert into pcm.regras_visita_contratual(id, serie_id, numero, ancora_semana, dia_semana, intervalo_semanas, hora_inicio, duracao_minutos, fuso, vigencia_inicio, created_by) values ('16600000-0000-0000-0000-000000000072', '16600000-0000-0000-0000-000000000061', 2, '2026-10-05', 2, 1, '08:00', 120, 'America/Sao_Paulo', '2026-10-31', '16600000-0000-0000-0000-000000000001') $$, '23P01', null, 'vigências inclusivas não se sobrepõem');
select throws_ok($$ insert into pcm.regras_visita_contratual(id, serie_id, numero, ancora_semana, dia_semana, intervalo_semanas, hora_inicio, duracao_minutos, fuso, vigencia_inicio, created_by) values ('16600000-0000-0000-0000-000000000073', '16600000-0000-0000-0000-000000000061', 2, '2026-11-02', 8, 1, '08:00', 120, 'America/Sao_Paulo', '2026-11-01', '16600000-0000-0000-0000-000000000001') $$, '23514', null, 'dia inválido é recusado');
select throws_ok($$ insert into pcm.regras_visita_contratual(id, serie_id, numero, ancora_semana, dia_semana, intervalo_semanas, hora_inicio, duracao_minutos, fuso, vigencia_inicio, created_by) values ('16600000-0000-0000-0000-000000000074', '16600000-0000-0000-0000-000000000061', 2, '2026-11-02', 2, 1, '08:00', 120, 'Fuso/Inexistente', '2026-11-01', '16600000-0000-0000-0000-000000000001') $$, '22023', null, 'fuso inválido é recusado');
select throws_ok($$ update pcm.regras_visita_contratual set dia_semana = 2 where id = '16600000-0000-0000-0000-000000000071' $$, '23514', null, 'conteúdo de versão existente é imutável');
select throws_ok($$ delete from pcm.regras_visita_contratual where id = '16600000-0000-0000-0000-000000000071' $$, '23514', null, 'versão histórica não pode ser excluída');
select throws_ok($$ update pcm.calendario_contratual_series set created_by = '16600000-0000-0000-0000-000000000002' where id = '16600000-0000-0000-0000-000000000061' $$, '23514', null, 'identidade da série não pode ser reescrita');
select throws_ok($$ delete from pcm.calendario_contratual_series where id = '16600000-0000-0000-0000-000000000061' $$, '23514', null, 'série com histórico não pode ser apagada');
select lives_ok($$ insert into pcm.regras_visita_contratual(id, serie_id, numero, ancora_semana, dia_semana, intervalo_semanas, hora_inicio, duracao_minutos, fuso, vigencia_inicio, created_by) values ('16600000-0000-0000-0000-000000000075', '16600000-0000-0000-0000-000000000061', 2, '2026-11-02', 2, 1, '08:00', 120, 'America/Sao_Paulo', '2026-11-01', '16600000-0000-0000-0000-000000000001') $$, 'versões com vigências consecutivas coexistem');
set local request.jwt.claims = '{"sub":"16600000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is((select count(*)::int from pcm.regras_visita_contratual), 2, 'gestor lê versões de seu Cliente');
select is((select count(*)::int from pcm.sso_listar_contratos_calendario('16600000-0000-0000-0000-00000000000a', 20, null)), 1, 'gestor lista contratos de seu Cliente');
select is((select to_jsonb(c) ? 'valor_mensal_centavos' from pcm.sso_listar_contratos_calendario('16600000-0000-0000-0000-00000000000a', 20, null) c limit 1), false, 'projeção não expõe valores comerciais');
select throws_ok($$ select * from pcm.sso_listar_contratos_calendario('16600000-0000-0000-0000-00000000000b', 20, null) $$, '42501', null, 'gestor não lista contrato de outro Cliente');
select throws_ok($$ insert into pcm.calendario_contratual_series(id, cliente_id, contrato_id, created_by) values ('16600000-0000-0000-0000-000000000063', '16600000-0000-0000-0000-00000000000a', '16600000-0000-0000-0000-000000000051', '16600000-0000-0000-0000-000000000001') $$, '42501', null, 'escrita direta é negada');
reset role;
insert into config.sso_concessoes(usuario_id, acao, cliente_id) values ('16600000-0000-0000-0000-000000000001', 'plano.gerir', '16600000-0000-0000-0000-00000000000b');
set local role authenticated;
select throws_ok($$ select pcm.sso_criar_regra_contratual_v2('16600000-0000-0000-0000-000000000107', 0, '16600000-0000-0000-0000-000000000065', '16600000-0000-0000-0000-000000000077', '16600000-0000-0000-0000-00000000000b', '16600000-0000-0000-0000-000000000051', '2026-10-05', 5, 1, '08:00', 120, 30, 'America/Sao_Paulo', '2026-10-01', null) $$, '42501', null, 'mesmo gestor de ambos Clientes não mistura contrato e contexto');
reset role;
delete from config.sso_concessoes where usuario_id = '16600000-0000-0000-0000-000000000001' and acao = 'plano.gerir' and cliente_id = '16600000-0000-0000-0000-00000000000b';
set local role authenticated;
select lives_ok($$ select pcm.sso_criar_regra_contratual('16600000-0000-0000-0000-000000000101', 0, '16600000-0000-0000-0000-000000000064', '16600000-0000-0000-0000-000000000076', '16600000-0000-0000-0000-000000000051', '2026-10-05', 5, 1, '08:00', 120, 30, 'America/Sao_Paulo', '2026-10-01', null) $$, 'gestor cria série e regra atomicamente');
select is((pcm.sso_criar_regra_contratual_v2('16600000-0000-0000-0000-000000000101', 0, '16600000-0000-0000-0000-000000000064', '16600000-0000-0000-0000-000000000076', '16600000-0000-0000-0000-00000000000a', '16600000-0000-0000-0000-000000000051', '2026-10-05', 5, 1, '08:00', 120, 30, 'America/Sao_Paulo', '2026-10-01', null)->>'revision')::int, 1, 'comando contextual preserva retry anterior');
select throws_ok($$ select pcm.sso_criar_regra_contratual_v2('16600000-0000-0000-0000-000000000101', 0, '16600000-0000-0000-0000-000000000064', '16600000-0000-0000-0000-000000000076', '16600000-0000-0000-0000-00000000000b', '16600000-0000-0000-0000-000000000051', '2026-10-05', 5, 1, '08:00', 120, 30, 'America/Sao_Paulo', '2026-10-01', null) $$, '42501', null, 'comando não aplica contrato de outro Cliente no contexto atual');
select is((select count(*)::int from pcm.sso_listar_regras_calendario('16600000-0000-0000-0000-00000000000a', 20, null)), 3, 'gestor consulta regras do Cliente');
select is((select count(*)::int from pcm.sso_listar_regras_calendario('16600000-0000-0000-0000-00000000000a', 1, '16600000-0000-0000-0000-000000000071')), 1, 'listagem limita e avança cursor');
select throws_ok($$ select * from pcm.sso_listar_regras_calendario('16600000-0000-0000-0000-00000000000b', 20, null) $$, '42501', null, 'listagem não expõe regras de outro Cliente');
select is((pcm.sso_criar_regra_contratual('16600000-0000-0000-0000-000000000101', 0, '16600000-0000-0000-0000-000000000064', '16600000-0000-0000-0000-000000000076', '16600000-0000-0000-0000-000000000051', '2026-10-05', 5, 1, '08:00', 120, 30, 'America/Sao_Paulo', '2026-10-01', null)->>'revision')::int, 1, 'retry devolve mesma revisão');
select throws_ok($$ select pcm.sso_criar_regra_contratual('16600000-0000-0000-0000-000000000101', 0, '16600000-0000-0000-0000-000000000064', '16600000-0000-0000-0000-000000000076', '16600000-0000-0000-0000-000000000051', '2026-10-05', 5, 1, '08:00', 90, 30, 'America/Sao_Paulo', '2026-10-01', null) $$, '23505', null, 'mesmo requestId não altera duração');
select throws_ok($$ select pcm.sso_criar_regra_contratual('16600000-0000-0000-0000-000000000102', 1, '16600000-0000-0000-0000-000000000065', '16600000-0000-0000-0000-000000000077', '16600000-0000-0000-0000-000000000051', '2026-10-05', 5, 1, '08:00', 120, 30, 'America/Sao_Paulo', '2026-10-01', null) $$, '40001', null, 'nova série exige revisão zero');
select throws_ok($$ select pcm.sso_criar_regra_contratual('16600000-0000-0000-0000-000000000103', 0, '16600000-0000-0000-0000-000000000065', '16600000-0000-0000-0000-000000000077', '16600000-0000-0000-0000-000000000099', '2026-10-05', 5, 1, '08:00', 120, 30, 'America/Sao_Paulo', '2026-10-01', null) $$, '42501', null, 'contrato não encontrado não expõe escopo');
select throws_ok($$ select pcm.sso_criar_regra_contratual('16600000-0000-0000-0000-000000000105', 0, '16600000-0000-0000-0000-000000000065', '16600000-0000-0000-0000-000000000077', '16600000-0000-0000-0000-000000000051', '2026-10-05', 8, 1, '08:00', 120, 30, 'America/Sao_Paulo', '2026-10-01', null) $$, '23514', null, 'comando recusa dia inválido');
select is((select count(*)::int from pcm.calendario_contratual_series where id = '16600000-0000-0000-0000-000000000065'), 0, 'erro desfaz criação parcial da série');
select throws_ok($$ select pcm.sso_criar_regra_contratual('16600000-0000-0000-0000-000000000106', 0, '16600000-0000-0000-0000-000000000065', '16600000-0000-0000-0000-000000000077', '16600000-0000-0000-0000-000000000051', '2026-10-05', 5, 1, '24:00', 120, 30, 'America/Sao_Paulo', '2026-10-01', null) $$, '22023', null, 'hora 24:00 não é aceita');
select throws_ok($$ select pcm.sso_criar_regra_contratual_v2('16600000-0000-0000-0000-000000000108', 0, '16600000-0000-0000-0000-000000000065', '16600000-0000-0000-0000-000000000077', '16600000-0000-0000-0000-00000000000a', '16600000-0000-0000-0000-000000000051', '2026-10-05', 5, 1, '08:00', 120, 30, 'America/Local_Inexistente', '2026-10-01', null) $$, '22023', null, 'RPC contextual recusa fuso inexistente');
select is((select count(*)::int from pcm.calendario_contratual_series where id = '16600000-0000-0000-0000-000000000065'), 0, 'fuso inválido desfaz criação parcial da série');
select is((select count(*)::int from pcm.regras_visita_contratual where id = '16600000-0000-0000-0000-000000000077'), 0, 'fuso inválido não cria regra');
set local request.jwt.claims = '{"sub":"16600000-0000-0000-0000-000000000002","role":"authenticated","user_role":"superadmin"}';
select is((select count(*)::int from pcm.regras_visita_contratual), 0, 'sem concessão não consulta regra');
select throws_ok($$ select pcm.sso_criar_regra_contratual('16600000-0000-0000-0000-000000000104', 0, '16600000-0000-0000-0000-000000000065', '16600000-0000-0000-0000-000000000077', '16600000-0000-0000-0000-000000000051', '2026-10-05', 5, 1, '08:00', 120, 30, 'America/Sao_Paulo', '2026-10-01', null) $$, '42501', null, 'sem concessão não cria regra');
reset role;
select is((select count(*)::int from audit.events where entity = 'calendario_contratual_series' and entity_id = '16600000-0000-0000-0000-000000000064'), 1, 'criação e retry produzem uma auditoria');
select is((select count(*)::int from audit.events where entity = 'calendario_contratual_series' and entity_id = '16600000-0000-0000-0000-000000000065'), 0, 'comando recusado não grava auditoria parcial');
update config.sso_concessoes set ativa = false where usuario_id = '16600000-0000-0000-0000-000000000001' and acao = 'plano.gerir';
set local request.jwt.claims = '{"sub":"16600000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$ select pcm.sso_criar_regra_contratual('16600000-0000-0000-0000-000000000101', 0, '16600000-0000-0000-0000-000000000064', '16600000-0000-0000-0000-000000000076', '16600000-0000-0000-0000-000000000051', '2026-10-05', 5, 1, '08:00', 120, 30, 'America/Sao_Paulo', '2026-10-01', null) $$, '42501', null, 'retry respeita revogação');
reset role;
select ok((select count(*) from pcm.ocorrencias_preventivas) = (select ocorrencias from s166_baseline) and (select count(*) from pcm.auvo_sync_outbox) = (select outbox from s166_baseline), 'criação não gera execução ou intenção Auvo');
select * from finish();
rollback;
