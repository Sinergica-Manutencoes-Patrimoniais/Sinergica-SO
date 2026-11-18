-- E01-S189 (SSO-016) — alcance das três ações de despesa da Visita que escrevem SEM gate:
-- alterar previsão, ratear entre OS, declarar repasse ao Cliente. As três compartilham a mesma
-- fixture (uma despesa, uma Visita, duas OS) porque contam a mesma história operacional.
begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18890000-0000-4000-8000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's189-despesa@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18890000-0000-4000-8000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's189-despesa-sem@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18890000-0000-4000-8000-000000000011', 'superadmin', 'S189 Despesa', true),
 ('18890000-0000-4000-8000-000000000012', 'colaborador', 'S189 Despesa Sem Concessão', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18890000-0000-4000-8000-00000000001a', 'Cliente S189 Despesa', true, '18890000-0000-4000-8000-000000000011');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18890000-0000-4000-8000-000000000011', 'despesa_visita.gerir', '18890000-0000-4000-8000-00000000001a'),
 ('18890000-0000-4000-8000-000000000011', 'faturavel.efetivar', '18890000-0000-4000-8000-00000000001a');
insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, created_by) values
 ('18890000-0000-4000-8000-00000000002a', '18890000-0000-4000-8000-00000000001a', 'OS-S189-DESP-1', 'OS 1', 'corretiva', '18890000-0000-4000-8000-000000000011'),
 ('18890000-0000-4000-8000-00000000002b', '18890000-0000-4000-8000-00000000001a', 'OS-S189-DESP-2', 'OS 2', 'corretiva', '18890000-0000-4000-8000-000000000011');
insert into pcm.visitas (id, cliente_id, inicio_em, fim_em, fuso, natureza, created_by) values
 ('18890000-0000-4000-8000-00000000003a', '18890000-0000-4000-8000-00000000001a', '2026-11-01 11:00+00', '2026-11-01 13:00+00', 'America/Sao_Paulo', 'regular', '18890000-0000-4000-8000-000000000011');
insert into pcm.visita_ordens_servico (id, visita_id, os_id, cliente_id, sequencia, created_by) values
 ('18890000-0000-4000-8000-00000000004a', '18890000-0000-4000-8000-00000000003a', '18890000-0000-4000-8000-00000000002a', '18890000-0000-4000-8000-00000000001a', 1, '18890000-0000-4000-8000-000000000011'),
 ('18890000-0000-4000-8000-00000000004b', '18890000-0000-4000-8000-00000000003a', '18890000-0000-4000-8000-00000000002b', '18890000-0000-4000-8000-00000000001a', 2, '18890000-0000-4000-8000-000000000011');
insert into pcm.despesa_tipos (id, auvo_id, nome) values ('18890000-0000-4000-8000-00000000005a', -189001, 'Categoria sintética S189');
-- Duas despesas, não uma: alterar previsão exige realizado NULO (0349) e declarar repasse exige
-- realizado PREENCHIDO (0404) — são precondições de negócio opostas, não algo que esta story
-- decide. A de rateio reaproveita a mesma com realizado preenchido (o rateio soma o realizado).
insert into pcm.despesas_visita (id, visita_id, cliente_id, categoria_id, data, descricao, previsto_centavos, realizado_centavos, created_by) values
 ('18890000-0000-4000-8000-00000000006a', '18890000-0000-4000-8000-00000000003a', '18890000-0000-4000-8000-00000000001a', '18890000-0000-4000-8000-00000000005a', '2026-11-01', 'Despesa S189 prevista', 10000, null, '18890000-0000-4000-8000-000000000011'),
 ('18890000-0000-4000-8000-00000000006b', '18890000-0000-4000-8000-00000000003a', '18890000-0000-4000-8000-00000000001a', '18890000-0000-4000-8000-00000000005a', '2026-11-01', 'Despesa S189 realizada', 10000, 10000, '18890000-0000-4000-8000-000000000011');

-- ── Caminho A: previsão — AC-1, AC-2, AC-3 ────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000011","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  format($f$ select pcm.sso_alterar_previsao_visita_mediada(%L,%L,1,'alterar','2026-11-05','Previsão revisada',15000,'Ajuste de valor') $f$,
    '18890000-0000-4000-8000-0000000000e1', '18890000-0000-4000-8000-00000000006a'),
  '55000', 'previsao_visita_indisponivel', 'gate de previsão fechado por padrão recusa com erro nomeado'
);

reset role;
update pcm.sso_previsao_visita_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000011","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is(
  (pcm.sso_alterar_previsao_visita_mediada('18890000-0000-4000-8000-0000000000e1', '18890000-0000-4000-8000-00000000006a',
    1, 'alterar', '2026-11-05', 'Previsão revisada', 15000, 'Ajuste de valor'))->>'revision',
  '2', 'com o gate aberto, alterar a previsão avança a revisão'
);
reset role;
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000012","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok(
  format($f$ select pcm.sso_alterar_previsao_visita_mediada(%L,%L,2,'alterar','2026-11-06','Outra',16000,'teste') $f$,
    '18890000-0000-4000-8000-0000000000e2', '18890000-0000-4000-8000-00000000006a'),
  '42501', 'despesa_nao_encontrada_ou_sem_acesso', 'sem a concessão despesa_visita.gerir, gate aberto não basta'
);

-- ── Caminho B: rateio — AC-1, AC-2 ─────────────────────────────────────────────────────────
reset role;
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000011","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
-- jsonb_build_array em vez de format(%L) dentro de string JSON: %L produz literal SQL
-- (aspas simples), inválido dentro de um valor JSON — precisa de aspas duplas, por isso o
-- array é montado como valor, nunca como texto interpolado.
select jsonb_build_array(
  jsonb_build_object('vinculoId', '18890000-0000-4000-8000-00000000004a', 'valorCentavos', 6000),
  jsonb_build_object('vinculoId', '18890000-0000-4000-8000-00000000004b', 'valorCentavos', 4000)
)::text as parcelas \gset

select throws_ok(
  format($f$ select pcm.sso_ratear_despesa_visita_mediada(%L,%L,1,%L::jsonb) $f$,
    '18890000-0000-4000-8000-0000000000e3', '18890000-0000-4000-8000-00000000006b', :'parcelas'),
  '55000', 'rateio_despesa_indisponivel', 'gate de rateio fechado por padrão recusa com erro nomeado'
);

reset role;
update pcm.sso_rateio_despesa_visita_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000011","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select lives_ok(
  format($f$ select pcm.sso_ratear_despesa_visita_mediada(%L,%L,1,%L::jsonb) $f$,
    '18890000-0000-4000-8000-0000000000e3', '18890000-0000-4000-8000-00000000006b', :'parcelas'),
  'com o gate aberto, o rateio exato entre as duas OS é aceito'
);
reset role;
select is(
  (select sum(valor_centavos)::bigint from pcm.despesa_visita_rateio_parcelas where despesa_id = '18890000-0000-4000-8000-00000000006b'),
  10000::bigint, 'o rateio gravado soma exatamente a despesa'
);

-- ── Caminho C: repasse ao Cliente — AC-1, AC-2, AC-3 ──────────────────────────────────────
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000011","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
-- revisao=2: o rateio do caminho B (acima) já bumpou a despesa_B de 1 para 2.
select throws_ok(
  format($f$ select financeiro.sso_declarar_repasse_despesa_mediada(%L,%L,2,'2026-11-01','Contrato prevê repasse integral','Combinado com o Cliente') $f$,
    '18890000-0000-4000-8000-0000000000e4', '18890000-0000-4000-8000-00000000006b'),
  '55000', 'repasse_despesa_indisponivel', 'gate de repasse fechado por padrão recusa com erro nomeado'
);

reset role;
update financeiro.sso_repasse_despesa_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000011","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select (financeiro.sso_declarar_repasse_despesa_mediada('18890000-0000-4000-8000-0000000000e4', '18890000-0000-4000-8000-00000000006b',
  2, '2026-11-01', 'Contrato prevê repasse integral', 'Combinado com o Cliente')) as repasse \gset
select isnt(:'repasse'::jsonb->>'aggregateId', null::text, 'com o gate aberto, o repasse declara o item a faturar de verdade');
select is(
  (financeiro.sso_declarar_repasse_despesa_mediada('18890000-0000-4000-8000-0000000000e4', '18890000-0000-4000-8000-00000000006b',
    2, '2026-11-01', 'Contrato prevê repasse integral', 'Combinado com o Cliente'))->>'aggregateId',
  :'repasse'::jsonb->>'aggregateId', 'replay do mesmo requestId devolve o mesmo recibo'
);

-- ── Os três núcleos continuam revogados — só os mediadores receberam grant ───────────────
reset role;
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where (n.nspname, p.proname) in (
       ('pcm', 'sso_alterar_previsao_visita'), ('pcm', 'sso_ratear_despesa_visita'),
       ('financeiro', 'sso_declarar_repasse_despesa'))
       and has_function_privilege('authenticated', p.oid, 'execute')),
  0, 'os três núcleos de despesa continuam revogados de authenticated'
);

select * from finish();
rollback;
