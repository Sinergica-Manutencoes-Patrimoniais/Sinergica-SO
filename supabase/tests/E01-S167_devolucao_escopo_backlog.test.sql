-- E01-S167 AC-6 (primeira metade: Chamado suspenso devolve parcela não resolvida ao Backlog).
-- Não cobre "cancelado com escopo pendente" — inalcançável hoje (fn_cancelar_chamado_conservador
-- exige tudo resolvido); fica para entrega futura de cancelamento não conservador.
begin;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('16760000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's167-devolucao@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('16760000-0000-4000-8000-000000000001', 'superadmin', 'S167 Devolução', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('16760000-0000-4000-8000-000000000002', 'Cliente S167 Devolução', true, '16760000-0000-4000-8000-000000000001'),
 ('16760000-0000-4000-8000-000000000003', 'Cliente Divergente S167', true, '16760000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values ('16760000-0000-4000-8000-000000000001', 'chamado.escopo.gerir', '16760000-0000-4000-8000-000000000002');
insert into pcm.sistemas (id, cliente_id, nome) values ('16760000-0000-4000-8000-000000000099', '16760000-0000-4000-8000-000000000002', 'Sistema S167 Devolução');
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('16760000-0000-4000-8000-000000000011', 'CH-S167-DEV', '16760000-0000-4000-8000-000000000002', 'Chamado devolução', '16760000-0000-4000-8000-000000000001');
insert into pcm.chamado_escopo_parcelas (id, chamado_id, descricao, situacao, created_by) values
 ('16760000-0000-4000-8000-000000000021', '16760000-0000-4000-8000-000000000011', 'Parcela pendente', 'pendente', '16760000-0000-4000-8000-000000000001'),
 ('16760000-0000-4000-8000-000000000022', '16760000-0000-4000-8000-000000000011', 'Parcela já atendida', 'atendida', '16760000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claims = '{"sub":"16760000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

select throws_ok($$ select pcm.sso_devolver_parcela_chamado_backlog(gen_random_uuid(),'16760000-0000-4000-8000-000000000002','16760000-0000-4000-8000-000000000011','16760000-0000-4000-8000-000000000021','sistema',gen_random_uuid(),'teste') $$, '55000', null, 'gate fechado por padrão recusa a devolução');

reset role;
update pcm.sso_devolucao_escopo_backlog_gate set habilitado = true where id;
insert into pcm.sso_suspensoes_chamado (chamado_id, cliente_id, estado, revisao) values ('16760000-0000-4000-8000-000000000011', '16760000-0000-4000-8000-000000000002', 'retomado', 2);
set local role authenticated;
set local request.jwt.claims = '{"sub":"16760000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

select throws_ok(format($f$ select pcm.sso_devolver_parcela_chamado_backlog(%L,%L,%L,%L,'sistema','16760000-0000-4000-8000-000000000099',%L) $f$,
  gen_random_uuid(), '16760000-0000-4000-8000-000000000002', '16760000-0000-4000-8000-000000000011', '16760000-0000-4000-8000-000000000021', 'teste'),
  '23514', 'chamado_nao_suspenso', 'chamado só retomado (não suspenso) recusa devolução');

reset role;
update pcm.sso_suspensoes_chamado set estado = 'suspenso' where chamado_id = '16760000-0000-4000-8000-000000000011';
set local role authenticated;
set local request.jwt.claims = '{"sub":"16760000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

select throws_ok(format($f$ select pcm.sso_devolver_parcela_chamado_backlog(%L,%L,%L,%L,'sistema',%L,'teste') $f$,
  gen_random_uuid(), '16760000-0000-4000-8000-000000000003', '16760000-0000-4000-8000-000000000011', '16760000-0000-4000-8000-000000000021', gen_random_uuid()),
  '42501', null, 'Cliente divergente é negado');

select throws_ok(format($f$ select pcm.sso_devolver_parcela_chamado_backlog(%L,%L,%L,%L,'sistema','16760000-0000-4000-8000-000000000099',%L) $f$,
  gen_random_uuid(), '16760000-0000-4000-8000-000000000002', '16760000-0000-4000-8000-000000000011', '16760000-0000-4000-8000-000000000022', 'teste'),
  '23514', 'parcela_indisponivel', 'parcela já atendida não é devolvida');

-- Achados da revisão adversarial (2026-11-10): alvo_id inexistente/de outro Cliente e motivo sem
-- limite de tamanho eram aceitos sem validação — corrigido na própria migration 1830 antes do PASS.
select throws_ok(format($f$ select pcm.sso_devolver_parcela_chamado_backlog(%L,%L,%L,%L,'sistema',%L,'teste') $f$,
  gen_random_uuid(), '16760000-0000-4000-8000-000000000002', '16760000-0000-4000-8000-000000000011', '16760000-0000-4000-8000-000000000021', gen_random_uuid()),
  '23514', 'alvo_invalido_ou_de_outro_cliente', 'alvo_id inexistente (nenhum sistema/componente/grupo real) é recusado');
select throws_ok(format($f$ select pcm.sso_devolver_parcela_chamado_backlog(%L,%L,%L,%L,'sistema','16760000-0000-4000-8000-000000000099',%L) $f$,
  gen_random_uuid(), '16760000-0000-4000-8000-000000000002', '16760000-0000-4000-8000-000000000011', '16760000-0000-4000-8000-000000000021', repeat('x', 2001)),
  '22023', 'parametros_invalidos', 'motivo acima de 2000 caracteres é recusado');

select (pcm.sso_devolver_parcela_chamado_backlog('16760000-0000-4000-8000-000000000031','16760000-0000-4000-8000-000000000002','16760000-0000-4000-8000-000000000011','16760000-0000-4000-8000-000000000021','sistema','16760000-0000-4000-8000-000000000099','escopo não resolvido, chamado suspenso')->>'backlogParcelaId') as backlog_id \gset

select ok(:'backlog_id' is not null, 'devolução bem-sucedida retorna id do registro de backlog');

-- Leitura direta de pcm.sso_backlog_parcelas/sso_backlog_composicoes/chamado_escopo_parcelas: as
-- três têm `revoke all ... from authenticated` nas migrations de origem — confere como role
-- privilegiada (pré-troca), não como `authenticated`.
reset role;
select is((select origem from pcm.sso_backlog_parcelas where id = :'backlog_id'), 'chamado_devolvido', 'registro de backlog marcado com origem chamado_devolvido');
select is((select pendencia_id from pcm.sso_backlog_parcelas where id = :'backlog_id'), null, 'devolução de Chamado não tem pendência técnica associada');
select is((select alvo_tipo from pcm.sso_backlog_composicoes c join pcm.sso_backlog_parcelas p on p.composicao_id = c.id where p.id = :'backlog_id'), 'sistema', 'composição criada usa o alvo escolhido pelo PCM');
select is((select situacao from pcm.chamado_escopo_parcelas where id = '16760000-0000-4000-8000-000000000021'), 'pendente', 'parcela devolvida continua "pendente" — devolução não apaga histórico nem finge atendimento');
set local role authenticated;
set local request.jwt.claims = '{"sub":"16760000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

select is(
  (pcm.sso_devolver_parcela_chamado_backlog('16760000-0000-4000-8000-000000000031','16760000-0000-4000-8000-000000000002','16760000-0000-4000-8000-000000000011','16760000-0000-4000-8000-000000000021','sistema','16760000-0000-4000-8000-000000000099','escopo não resolvido, chamado suspenso')->>'backlogParcelaId'),
  :'backlog_id', 'replay do mesmo request_id devolve a mesma resposta, sem duplicar'
);

select throws_ok($$ select pcm.sso_devolver_parcela_chamado_backlog(gen_random_uuid(),'16760000-0000-4000-8000-000000000002','16760000-0000-4000-8000-000000000011','16760000-0000-4000-8000-000000000021','sistema','16760000-0000-4000-8000-000000000099','segunda tentativa') $$, '23505', 'parcela_ja_devolvida', 'tentar devolver a mesma parcela de novo (request_id novo) é recusado');

select * from finish();
rollback;
