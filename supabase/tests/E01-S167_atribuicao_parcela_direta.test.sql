-- E01-S167 AC-4 (atribuição direta de parcela pendente a uma OS já aberta do mesmo Chamado, sem
-- passar por Backlog nem criar OS nova, migration 1197) — prova real de ponta a ponta. Achado ao
-- escrever este teste: `sso_os_para_parcela_direta`/`sso_atribuir_parcela_direta` nunca tinham
-- grant execute a authenticated — o caminho "atribuição direta" de `AtribuirParcela.tsx` estava
-- inalcançável em qualquer ambiente real (fix em migration 1837).
begin;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('16790000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's167-atribuicao-direta@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('16790000-0000-4000-8000-000000000001', 'superadmin', 'S167 Atribuição Direta', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('16790000-0000-4000-8000-000000000002', 'Cliente S167 Atribuição Direta', true, '16790000-0000-4000-8000-000000000001'),
 ('16790000-0000-4000-8000-000000000003', 'Cliente Divergente S167 Atribuição', true, '16790000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('16790000-0000-4000-8000-000000000001', 'chamado.escopo.gerir', '16790000-0000-4000-8000-000000000002');
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('16790000-0000-4000-8000-000000000004', 'CH-S167-ATRDIR', '16790000-0000-4000-8000-000000000002', 'Chamado atribuição direta', '16790000-0000-4000-8000-000000000001');
insert into pcm.chamado_escopo_composicoes (chamado_id, revisao) values ('16790000-0000-4000-8000-000000000004', 1);
insert into pcm.chamado_escopo_parcelas (id, chamado_id, descricao, situacao, created_by) values
 ('16790000-0000-4000-8000-000000000005', '16790000-0000-4000-8000-000000000004', 'Parcela A pendente', 'pendente', '16790000-0000-4000-8000-000000000001'),
 ('16790000-0000-4000-8000-000000000006', '16790000-0000-4000-8000-000000000004', 'Parcela B pendente', 'pendente', '16790000-0000-4000-8000-000000000001');

set local request.jwt.claims = '{"sub":"16790000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

-- Precisamos de 2 OS no mesmo Chamado pra testar a listagem/atribuição direta. Até a migration
-- 1842 isso exigia simular o corte 1:1 -> 1:N aqui dentro (drop do índice legado e da trigger de
-- numeração legada); o corte agora faz parte do schema, então a fixture só precisa do token de
-- comando da guarda (1499) pra segunda OS, como qualquer escritor real.
-- O `numero` abaixo é sobrescrito por `pcm.sso_numero_os_chamado_compativel()` (1500) e nunca é
-- asserido — serve só de rótulo de leitura da fixture.
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, updated_at, created_by) values
 ('16790000-0000-4000-8000-000000000007', '16790000-0000-4000-8000-000000000002', '16790000-0000-4000-8000-000000000004', 'OS-S167-ATRDIR-ABERTA', 'OS aberta do mesmo Chamado', 'corretiva', 'em_execucao', now(), '16790000-0000-4000-8000-000000000001');
insert into pcm.sso_guarda_multiplas_os_tokens(txid, ator_id, chamado_id, cliente_id, os_id) values
 (pg_catalog.txid_current(), '16790000-0000-4000-8000-000000000001', '16790000-0000-4000-8000-000000000004', '16790000-0000-4000-8000-000000000002', '16790000-0000-4000-8000-000000000008');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, updated_at, created_by) values
 ('16790000-0000-4000-8000-000000000008', '16790000-0000-4000-8000-000000000002', '16790000-0000-4000-8000-000000000004', 'OS-S167-ATRDIR-FINAL', 'OS já finalizada do mesmo Chamado', 'corretiva', 'finalizado', now(), '16790000-0000-4000-8000-000000000001');

set local role authenticated;

select throws_ok(
  format($f$ select pcm.sso_os_para_parcela_direta(%L,%L,%L,%L,null,20) $f$,
    '16790000-0000-4000-8000-000000000001', '16790000-0000-4000-8000-000000000002', '16790000-0000-4000-8000-000000000004', '16790000-0000-4000-8000-000000000005'),
  '55000', 'atribuicao_direta_desabilitada', 'gate de atribuição direta fechado por padrão recusa a listagem'
);

reset role;
update pcm.sso_atribuicao_direta_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"16790000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select pcm.sso_os_para_parcela_direta(%L,%L,%L,%L,null,20) $f$,
    '16790000-0000-4000-8000-000000000001', '16790000-0000-4000-8000-000000000002', '16790000-0000-4000-8000-000000000004', '16790000-0000-4000-8000-000000000005'),
  '55000', 'atribuicao_desabilitada', 'gate geral de atribuição de parcela (compartilhado com o caminho Backlog) também precisa estar aberto'
);

reset role;
update pcm.sso_atribuicao_parcela_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"16790000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select is(
  (select count(*)::int from pcm.sso_os_para_parcela_direta('16790000-0000-4000-8000-000000000001', '16790000-0000-4000-8000-000000000002', '16790000-0000-4000-8000-000000000004', '16790000-0000-4000-8000-000000000005', null, 20)),
  1, 'lista só a OS aberta do mesmo Chamado, nunca a já finalizada'
);
select is(
  (select os_id from pcm.sso_os_para_parcela_direta('16790000-0000-4000-8000-000000000001', '16790000-0000-4000-8000-000000000002', '16790000-0000-4000-8000-000000000004', '16790000-0000-4000-8000-000000000005', null, 20) limit 1),
  '16790000-0000-4000-8000-000000000007', 'OS listada é a aberta certa'
);

select (pcm.sso_os_para_parcela_direta('16790000-0000-4000-8000-000000000001', '16790000-0000-4000-8000-000000000002', '16790000-0000-4000-8000-000000000004', '16790000-0000-4000-8000-000000000005', null, 20)).os_atualizada_em as os_atualizada_em \gset

select throws_ok(
  format($f$ select pcm.sso_atribuir_parcela_direta(gen_random_uuid(),%L,%L,%L,%L,%L,1,1,%L,%L::timestamptz,'Mesma equipe já em campo') $f$,
    '16790000-0000-4000-8000-000000000001', '16790000-0000-4000-8000-000000000003', '16790000-0000-4000-8000-000000000004', '16790000-0000-4000-8000-000000000005',
    '16790000-0000-4000-8000-000000000007', 'em_execucao', :'os_atualizada_em'),
  '42501', 'sem_acesso', 'Cliente divergente é recusado'
);

select (pcm.sso_atribuir_parcela_direta('16790000-0000-4000-8000-000000000031', '16790000-0000-4000-8000-000000000001', '16790000-0000-4000-8000-000000000002',
  '16790000-0000-4000-8000-000000000004', '16790000-0000-4000-8000-000000000005', '16790000-0000-4000-8000-000000000007', 1, 1,
  'em_execucao', :'os_atualizada_em'::timestamptz, 'Mesma equipe já em campo')) as atribuicao_1 \gset
select is(:'atribuicao_1'::jsonb->>'osId', '16790000-0000-4000-8000-000000000007', 'atribuição direta aceita, aponta pra OS certa');
select is(:'atribuicao_1'::jsonb->>'execucaoComprovada', 'false', 'atribuição nunca afirma execução comprovada sozinha');

select is(
  (pcm.sso_atribuir_parcela_direta('16790000-0000-4000-8000-000000000031', '16790000-0000-4000-8000-000000000001', '16790000-0000-4000-8000-000000000002',
    '16790000-0000-4000-8000-000000000004', '16790000-0000-4000-8000-000000000005', '16790000-0000-4000-8000-000000000007', 1, 1,
    'em_execucao', :'os_atualizada_em'::timestamptz, 'Mesma equipe já em campo'))::jsonb->>'requestId',
  :'atribuicao_1'::jsonb->>'requestId', 'replay do mesmo requestId devolve o mesmo resultado, sem duplicar'
);

select throws_ok(
  format($f$ select pcm.sso_atribuir_parcela_direta(gen_random_uuid(),%L,%L,%L,%L,%L,1,1,%L,%L::timestamptz,'segunda tentativa') $f$,
    '16790000-0000-4000-8000-000000000001', '16790000-0000-4000-8000-000000000002', '16790000-0000-4000-8000-000000000004', '16790000-0000-4000-8000-000000000005',
    '16790000-0000-4000-8000-000000000007', 'em_execucao', :'os_atualizada_em'),
  '23514', 'escopo_ou_os_indisponivel', 'parcela já atribuída não é atribuída de novo'
);

select throws_ok(
  format($f$ select pcm.sso_atribuir_parcela_direta(gen_random_uuid(),%L,%L,%L,%L,%L,2,1,%L,%L::timestamptz,'revisão errada') $f$,
    '16790000-0000-4000-8000-000000000001', '16790000-0000-4000-8000-000000000002', '16790000-0000-4000-8000-000000000004', '16790000-0000-4000-8000-000000000006',
    '16790000-0000-4000-8000-000000000007', 'em_execucao', :'os_atualizada_em'),
  '40001', 'revisao_obsoleta', 'chamado_revision desatualizada é recusada'
);

select throws_ok(
  format($f$ select pcm.sso_atribuir_parcela_direta(gen_random_uuid(),%L,%L,%L,%L,%L,1,1,'finalizado',%L,'OS já finalizada') $f$,
    '16790000-0000-4000-8000-000000000001', '16790000-0000-4000-8000-000000000002', '16790000-0000-4000-8000-000000000004', '16790000-0000-4000-8000-000000000006',
    '16790000-0000-4000-8000-000000000008', (select updated_at from pcm.ordens_servico where id = '16790000-0000-4000-8000-000000000008')),
  '23514', 'escopo_ou_os_indisponivel', 'OS já finalizada do mesmo Chamado nunca recebe atribuição direta'
);

reset role;
select throws_ok(
  $$ update pcm.sso_atribuicoes_diretas set parcela_id = gen_random_uuid() where true $$,
  '23514', null, 'histórico de atribuição direta é append-only, nunca editado'
);

select * from finish();
rollback;
