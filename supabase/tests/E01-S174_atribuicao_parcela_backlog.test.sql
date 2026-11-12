-- E01-S174 (Backlog de escopo rastreável) — prova do comando central da story.
-- S174 tinha 62 RPCs chamadas pela UI e UM arquivo de teste. `pcm.sso_atribuir_parcela_os`
-- (migration 0456) é o comando que fecha o ciclo do Backlog: uma parcela de escopo só pode ser
-- atribuída a uma OS se ANTES tiver passado pelo Backlog (`pcm.sso_backlog_parcelas`) — é essa
-- exigência que torna o escopo rastreável, e é exatamente a regra que nenhum teste cobria.
begin;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('17400000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's174-gestor@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('17400000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's174-sem-concessao@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('17400000-0000-4000-8000-000000000001', 'superadmin', 'S174 Gestor', true),
 ('17400000-0000-4000-8000-000000000002', 'colaborador', 'S174 Sem Concessão', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('17400000-0000-4000-8000-00000000000a', 'Cliente S174', true, '17400000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('17400000-0000-4000-8000-000000000001', 'chamado.escopo.gerir', '17400000-0000-4000-8000-00000000000a');

-- Chamado A: fluxo feliz. Chamado B: OS já finalizada (Chamado separado por causa da guarda
-- legada 1:1 Chamado:OS, que ainda copia o número do Chamado para a OS).
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('17400000-0000-4000-8000-00000000001a', 'CH-S174-A', '17400000-0000-4000-8000-00000000000a', 'Chamado com escopo parcelado', '17400000-0000-4000-8000-000000000001'),
 ('17400000-0000-4000-8000-00000000001b', 'CH-S174-B', '17400000-0000-4000-8000-00000000000a', 'Chamado com OS finalizada', '17400000-0000-4000-8000-000000000001');
insert into pcm.chamado_escopo_composicoes (chamado_id, revisao) values
 ('17400000-0000-4000-8000-00000000001a', 1),
 ('17400000-0000-4000-8000-00000000001b', 1);
insert into pcm.chamado_escopo_parcelas (id, chamado_id, descricao, situacao, created_by) values
 ('17400000-0000-4000-8000-00000000002a', '17400000-0000-4000-8000-00000000001a', 'Parcela A1', 'pendente', '17400000-0000-4000-8000-000000000001'),
 ('17400000-0000-4000-8000-00000000002c', '17400000-0000-4000-8000-00000000001a', 'Parcela A2 (fora do Backlog)', 'pendente', '17400000-0000-4000-8000-000000000001'),
 ('17400000-0000-4000-8000-00000000002b', '17400000-0000-4000-8000-00000000001b', 'Parcela B1', 'pendente', '17400000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, updated_at, created_by) values
 ('17400000-0000-4000-8000-00000000003a', '17400000-0000-4000-8000-00000000000a', '17400000-0000-4000-8000-00000000001a', 'OS-S174-A', 'OS aberta', 'corretiva', 'em_execucao', now(), '17400000-0000-4000-8000-000000000001'),
 ('17400000-0000-4000-8000-00000000003b', '17400000-0000-4000-8000-00000000000a', '17400000-0000-4000-8000-00000000001b', 'OS-S174-B', 'OS finalizada', 'corretiva', 'finalizado', now(), '17400000-0000-4000-8000-000000000001');

select updated_at as os_a_em from pcm.ordens_servico where id = '17400000-0000-4000-8000-00000000003a' \gset
select updated_at as os_b_em from pcm.ordens_servico where id = '17400000-0000-4000-8000-00000000003b' \gset

set local request.jwt.claims = '{"sub":"17400000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select pcm.sso_atribuir_parcela_os(gen_random_uuid(),%L,%L,1,1,'em_execucao',%L::timestamptz,'Atribuição inicial') $f$,
    '17400000-0000-4000-8000-00000000002a', '17400000-0000-4000-8000-00000000003a', :'os_a_em'),
  '55000', 'atribuicao_desabilitada', 'gate de atribuição fechado por padrão recusa'
);

reset role;
update pcm.sso_atribuicao_parcela_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"17400000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select pcm.sso_atribuir_parcela_os(gen_random_uuid(),%L,%L,1,1,'em_execucao',%L::timestamptz,'   ') $f$,
    '17400000-0000-4000-8000-00000000002a', '17400000-0000-4000-8000-00000000003a', :'os_a_em'),
  '22023', 'parametros_invalidos', 'motivo em branco é recusado'
);

select throws_ok(
  format($f$ select pcm.sso_atribuir_parcela_os(gen_random_uuid(),gen_random_uuid(),%L,1,1,'em_execucao',%L::timestamptz,'Parcela inexistente') $f$,
    '17400000-0000-4000-8000-00000000003a', :'os_a_em'),
  '23514', 'parcela_indisponivel', 'parcela inexistente é recusada'
);

select throws_ok(
  format($f$ select pcm.sso_atribuir_parcela_os(gen_random_uuid(),%L,%L,2,1,'em_execucao',%L::timestamptz,'Revisão errada') $f$,
    '17400000-0000-4000-8000-00000000002a', '17400000-0000-4000-8000-00000000003a', :'os_a_em'),
  '40001', 'revisao_obsoleta', 'revisão do Chamado desatualizada é recusada'
);

-- A regra central da S174: sem passagem pelo Backlog, não há atribuição.
select throws_ok(
  format($f$ select pcm.sso_atribuir_parcela_os(gen_random_uuid(),%L,%L,1,1,'em_execucao',%L::timestamptz,'Pulando o Backlog') $f$,
    '17400000-0000-4000-8000-00000000002a', '17400000-0000-4000-8000-00000000003a', :'os_a_em'),
  '23514', 'escopo_ou_os_indisponivel', 'parcela que nunca entrou no Backlog não pode ser atribuída a uma OS'
);

-- Entrada no Backlog (o passo que torna o escopo rastreável).
reset role;
-- A composição de Backlog é o agrupamento por ativo-alvo; `alvo_id` é polimórfico (sem FK).
insert into pcm.sso_backlog_composicoes (id, cliente_id, alvo_tipo, alvo_id, criado_por) values
 ('17400000-0000-4000-8000-0000000000c1', '17400000-0000-4000-8000-00000000000a', 'sistema', '17400000-0000-4000-8000-0000000000d1', '17400000-0000-4000-8000-000000000001'),
 ('17400000-0000-4000-8000-0000000000c2', '17400000-0000-4000-8000-00000000000a', 'sistema', '17400000-0000-4000-8000-0000000000d2', '17400000-0000-4000-8000-000000000001');
-- origem 'chamado_devolvido' é a que dispensa pendencia_id (constraint da migration 1830).
insert into pcm.sso_backlog_parcelas (parcela_id, composicao_id, chamado_id, cliente_id, ator_id, request_id, payload, origem) values
 ('17400000-0000-4000-8000-00000000002a', '17400000-0000-4000-8000-0000000000c1', '17400000-0000-4000-8000-00000000001a',
  '17400000-0000-4000-8000-00000000000a', '17400000-0000-4000-8000-000000000001', '17400000-0000-4000-8000-0000000000f0', '{}'::jsonb, 'chamado_devolvido'),
 ('17400000-0000-4000-8000-00000000002b', '17400000-0000-4000-8000-0000000000c2', '17400000-0000-4000-8000-00000000001b',
  '17400000-0000-4000-8000-00000000000a', '17400000-0000-4000-8000-000000000001', '17400000-0000-4000-8000-0000000000f1', '{}'::jsonb, 'chamado_devolvido');
set local request.jwt.claims = '{"sub":"17400000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select (pcm.sso_atribuir_parcela_os('17400000-0000-4000-8000-0000000000e1', '17400000-0000-4000-8000-00000000002a',
  '17400000-0000-4000-8000-00000000003a', 1, 1, 'em_execucao', :'os_a_em'::timestamptz, 'Atribuição inicial')) as atribuicao \gset
select is(:'atribuicao'::jsonb->>'parcelaId', '17400000-0000-4000-8000-00000000002a', 'parcela vinda do Backlog é atribuída à OS');
select is(:'atribuicao'::jsonb->>'execucaoComprovada', 'false', 'atribuir não afirma execução comprovada');

select is(
  (pcm.sso_atribuir_parcela_os('17400000-0000-4000-8000-0000000000e1', '17400000-0000-4000-8000-00000000002a',
    '17400000-0000-4000-8000-00000000003a', 1, 1, 'em_execucao', :'os_a_em'::timestamptz, 'Atribuição inicial'))->>'parcelaId',
  '17400000-0000-4000-8000-00000000002a', 'replay do mesmo requestId devolve o mesmo resultado'
);

select throws_ok(
  format($f$ select pcm.sso_atribuir_parcela_os(%L,%L,%L,1,1,'em_execucao',%L::timestamptz,'Motivo diferente') $f$,
    '17400000-0000-4000-8000-0000000000e1', '17400000-0000-4000-8000-00000000002a', '17400000-0000-4000-8000-00000000003a', :'os_a_em'),
  '23505', 'request_id_conflitante', 'mesmo requestId com payload diferente é recusado'
);

-- Dupla atribuição da mesma parcela: barrada pela PK (parcela_id) de sso_atribuicoes_parcela.
-- Diferente de sso_atribuir_parcela_direta, esta função não tem checagem explícita — quem
-- garante a unicidade aqui é o schema, e isso precisa continuar verdadeiro.
select throws_ok(
  format($f$ select pcm.sso_atribuir_parcela_os(gen_random_uuid(),%L,%L,1,1,'em_execucao',%L::timestamptz,'Segunda atribuição') $f$,
    '17400000-0000-4000-8000-00000000002a', '17400000-0000-4000-8000-00000000003a', :'os_a_em'),
  '23505', null, 'mesma parcela nunca é atribuída duas vezes (PK de sso_atribuicoes_parcela)'
);

select throws_ok(
  format($f$ select pcm.sso_atribuir_parcela_os(gen_random_uuid(),%L,%L,1,1,'finalizado',%L::timestamptz,'OS encerrada') $f$,
    '17400000-0000-4000-8000-00000000002b', '17400000-0000-4000-8000-00000000003b', :'os_b_em'),
  '23514', 'escopo_ou_os_indisponivel', 'OS finalizada nunca recebe parcela, mesmo vinda do Backlog'
);

reset role;
set local request.jwt.claims = '{"sub":"17400000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok(
  format($f$ select pcm.sso_atribuir_parcela_os(gen_random_uuid(),%L,%L,1,1,'em_execucao',%L::timestamptz,'Sem concessão') $f$,
    '17400000-0000-4000-8000-00000000002c', '17400000-0000-4000-8000-00000000003a', :'os_a_em'),
  '42501', 'sem_acesso', 'usuário sem a concessão chamado.escopo.gerir é recusado'
);

reset role;
select throws_ok(
  $$ update pcm.sso_atribuicoes_parcela set payload = '{}'::jsonb where true $$,
  '23514', null, 'histórico de atribuição é append-only, nunca editado (migration 1840)'
);

select * from finish();
rollback;
