-- E01-S189 (SSO-015) — alcance de comercial.sso_criar_orcamento_operacional, que escreve SEM
-- gate de banco: antes desta story, nenhum papel tinha execute, e a tela falhava com
-- `permission denied` indistinguível de bug. Agora o alcance passa pelo mediador, com gate
-- próprio fechado por padrão (AC-1, AC-2, AC-3).
begin;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18890000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's189-orcamento@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18890000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's189-orcamento-sem@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18890000-0000-4000-8000-000000000001', 'superadmin', 'S189 Orçamento', true),
 ('18890000-0000-4000-8000-000000000002', 'colaborador', 'S189 Orçamento Sem Concessão', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18890000-0000-4000-8000-00000000000a', 'Cliente S189 Orçamento', true, '18890000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18890000-0000-4000-8000-000000000001', 'orcamento.emitir', '18890000-0000-4000-8000-00000000000a'),
 ('18890000-0000-4000-8000-000000000001', 'custo.ler', '18890000-0000-4000-8000-00000000000a'),
 ('18890000-0000-4000-8000-000000000001', 'material.gerir', '18890000-0000-4000-8000-00000000000a');
insert into comercial.etapas_funil (id, nome, ordem, cor) values
 ('18890000-0000-4000-8000-00000000001e', 'Em negociação S189', 1, '#000000');
insert into comercial.oportunidades (id, cliente_id, etapa_id, titulo, created_by) values
 ('18890000-0000-4000-8000-00000000001a', '18890000-0000-4000-8000-00000000000a', '18890000-0000-4000-8000-00000000001e', 'Oportunidade S189', '18890000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, created_by) values
 ('18890000-0000-4000-8000-00000000002a', '18890000-0000-4000-8000-00000000000a', 'OS-S189-ORC', 'OS do orçamento', 'corretiva', '18890000-0000-4000-8000-000000000001');
insert into pcm.listas_materiais (id, cliente_id, ordem_servico_id, responsavel, texto_original, criado_por) values
 ('18890000-0000-4000-8000-00000000003a', '18890000-0000-4000-8000-00000000000a', '18890000-0000-4000-8000-00000000002a', 'sinergica', 'Disjuntor 40A', '18890000-0000-4000-8000-000000000001');

-- ── AC-1: gate fechado (padrão) recusa com erro nomeado ───────────────────────────────────
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  format($f$ select comercial.sso_criar_orcamento_operacional_mediada(%L,%L,%L,1) $f$,
    '18890000-0000-4000-8000-0000000000e1', '18890000-0000-4000-8000-00000000001a', '18890000-0000-4000-8000-00000000003a'),
  '55000', 'orcamento_operacional_indisponivel',
  'gate de orçamento operacional fechado por padrão recusa com erro nomeado, não permission denied'
);

reset role;
update comercial.sso_orcamento_operacional_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

-- ── AC-2: gate aberto + concessão correta executa e é idempotente ────────────────────────
select (comercial.sso_criar_orcamento_operacional_mediada('18890000-0000-4000-8000-0000000000e1',
  '18890000-0000-4000-8000-00000000001a', '18890000-0000-4000-8000-00000000003a', 1)) as resultado \gset
select isnt(:'resultado'::jsonb->>'aggregateId', null::text, 'com gate aberto, o orçamento é criado de verdade');
select is(
  (comercial.sso_criar_orcamento_operacional_mediada('18890000-0000-4000-8000-0000000000e1',
    '18890000-0000-4000-8000-00000000001a', '18890000-0000-4000-8000-00000000003a', 1))->>'aggregateId',
  :'resultado'::jsonb->>'aggregateId', 'replay do mesmo requestId devolve o mesmo recibo, não duplica'
);

-- ── AC-3: gate aberto, mas usuário sem concessão continua recusado ────────────────────────
reset role;
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok(
  format($f$ select comercial.sso_criar_orcamento_operacional_mediada(%L,%L,%L,1) $f$,
    '18890000-0000-4000-8000-0000000000e2', '18890000-0000-4000-8000-00000000001a', '18890000-0000-4000-8000-00000000003a'),
  '42501', 'origem_nao_encontrada_ou_sem_acesso',
  'abrir o gate libera a FUNCIONALIDADE; a AUTORIZAÇÃO por concessão continua sendo decidida pelo núcleo'
);

reset role;
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'comercial' and p.proname = 'sso_criar_orcamento_operacional'
       and has_function_privilege('authenticated', p.oid, 'execute')),
  0, 'o núcleo continua revogado de authenticated — só o mediador recebeu grant'
);

select * from finish();
rollback;
