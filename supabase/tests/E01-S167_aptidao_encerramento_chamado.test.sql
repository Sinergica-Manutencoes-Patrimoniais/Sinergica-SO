-- E01-S167 US2/AC-5: aptidão calculada e encerramento explícito exige escopo integral.
-- Até 2026-11-10, pcm.sso_diagnosticar_aptidao_chamado/sso_encerrar_chamado_conferido (0621/0611)
-- nunca tinham grant a `authenticated` em nenhuma migration — migration 1831 fecha isso. Este
-- arquivo substitui a antiga caracterização "inalcançável" (E01-S167_aptidao_encerramento_inalcancavel.test.sql)
-- agora que a regra de negócio pode ser exercida de verdade.
begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('16753000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's167-aptidao2@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('16753000-0000-4000-8000-000000000001', 'superadmin', 'S167 Aptidão 2', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('16753000-0000-4000-8000-000000000002', 'Cliente S167 Aptidão 2', true, '16753000-0000-4000-8000-000000000001'),
 ('16753000-0000-4000-8000-000000000003', 'Cliente Divergente S167 Aptidão', true, '16753000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values ('16753000-0000-4000-8000-000000000001', 'chamado.encerrar', '16753000-0000-4000-8000-000000000002');
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('16753000-0000-4000-8000-000000000011', 'CH-S167-APT2', '16753000-0000-4000-8000-000000000002', 'Chamado aptidão 2', '16753000-0000-4000-8000-000000000001');
insert into pcm.chamado_escopo_composicoes (chamado_id, declarada_completa) values ('16753000-0000-4000-8000-000000000011', true);
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, created_by) values
 ('16753000-0000-4000-8000-000000000012', '16753000-0000-4000-8000-000000000002', '16753000-0000-4000-8000-000000000011', 'OS-S167-APT2', 'OS aptidão', 'corretiva', 'finalizado', '16753000-0000-4000-8000-000000000001');
insert into pcm.chamado_escopo_parcelas (id, chamado_id, descricao, situacao, created_by) values
 ('16753000-0000-4000-8000-000000000021', '16753000-0000-4000-8000-000000000011', 'Parcela ainda pendente', 'pendente', '16753000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claims = '{"sub":"16753000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

select throws_ok($$ select pcm.sso_diagnosticar_aptidao_chamado('16753000-0000-4000-8000-000000000002','16753000-0000-4000-8000-000000000011') $$, '55000', null, 'gate fechado por padrão recusa o diagnóstico');
select throws_ok($$ select pcm.sso_encerrar_chamado_conferido(gen_random_uuid(),'16753000-0000-4000-8000-000000000002','16753000-0000-4000-8000-000000000011',1,'teste') $$, '55000', null, 'gate fechado por padrão recusa o encerramento');

reset role;
update pcm.chamado_os_gate set habilitado = true where id;
update pcm.sso_encerramento_chamado_gate set habilitado = true where id;
set local role authenticated;
set local request.jwt.claims = '{"sub":"16753000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

select throws_ok($$ select pcm.sso_diagnosticar_aptidao_chamado('16753000-0000-4000-8000-000000000003','16753000-0000-4000-8000-000000000011') $$, '42501', null, 'Cliente divergente é negado');
select is((pcm.sso_diagnosticar_aptidao_chamado('16753000-0000-4000-8000-000000000002','16753000-0000-4000-8000-000000000011')->>'aptoIndicativo')::boolean, false, 'escopo com parcela pendente não indica aptidão');
select throws_ok($$ select pcm.sso_encerrar_chamado_conferido(gen_random_uuid(),'16753000-0000-4000-8000-000000000002','16753000-0000-4000-8000-000000000011',1,'teste') $$, '23514', 'escopo_nao_atendido', 'encerramento recusado com escopo não atendido');

reset role;
update pcm.chamado_escopo_parcelas set situacao = 'atendida', os_atendimento_id = '16753000-0000-4000-8000-000000000012' where id = '16753000-0000-4000-8000-000000000021';
set local role authenticated;
set local request.jwt.claims = '{"sub":"16753000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

select is((pcm.sso_diagnosticar_aptidao_chamado('16753000-0000-4000-8000-000000000002','16753000-0000-4000-8000-000000000011')->>'aptoIndicativo')::boolean, true, 'escopo integral (parcela atendida, OS finalizada, sem continuação pendente) indica aptidão');

select (pcm.sso_encerrar_chamado_conferido('16753000-0000-4000-8000-000000000031','16753000-0000-4000-8000-000000000002','16753000-0000-4000-8000-000000000011',1,'escopo integral, encerramento explícito do PCM')->>'revision') as rev_pos_encerramento \gset

select ok(:'rev_pos_encerramento' is not null, 'encerramento explícito com escopo integral é aceito e devolve a nova revisão');
select is(
  (pcm.sso_encerrar_chamado_conferido('16753000-0000-4000-8000-000000000031','16753000-0000-4000-8000-000000000002','16753000-0000-4000-8000-000000000011',1,'escopo integral, encerramento explícito do PCM')->>'revision'),
  :'rev_pos_encerramento', 'replay do mesmo request_id devolve a mesma resposta, sem reencerrar'
);
select throws_ok($$ select pcm.sso_encerrar_chamado_conferido(gen_random_uuid(),'16753000-0000-4000-8000-000000000002','16753000-0000-4000-8000-000000000011',1,'segunda tentativa') $$, '40001', 'revisao_obsoleta', 'tentar encerrar de novo com a revisão antiga (pré-encerramento) é recusado como obsoleta');

select * from finish();
rollback;
