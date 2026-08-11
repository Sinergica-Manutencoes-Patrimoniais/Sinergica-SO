-- comercial_levantamento_rls.test.sql — pgTAP (E03-S05)
-- Guardas das 3 RPCs publicadas pelo PCM para o levantamento de pré-venda (ADR-0019 R1/R2):
-- `pcm.fn_criar_assessment_pre_venda`, `pcm.fn_listar_assessments_conta`,
-- `pcm.fn_listar_itens_assessment`. Confirma que um usuário SÓ-comercial (sem módulo pcm) passa
-- pela guarda e consegue criar/ler o Assessment, e que o RLS real de `pcm.inspecoes` (que exige
-- módulo pcm) não vaza pra quem chama pela RPC. Rodar com `supabase test db` (requer Docker).
--
-- OBS: `d3a30ba8-b1e1-41d6-80e4-69bb0daaf64c` (usuário real de produção usado no smoke test manual
-- desta story) não existe no banco de teste local — aqui usamos os usuários de teste próprios,
-- criados abaixo, como em `comercial_proposta_rls.test.sql` (E03-S04).

begin;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lev-sem-modulo-s05@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lev-comercial-escrita-s05@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lev-comercial-leitura-s05@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, ativo)
values
  ('00000000-0000-0000-0000-0000000007c1', 'Condomínio Teste E03-S05', true),
  ('00000000-0000-0000-0000-0000000007c2', 'Condomínio Teste E03-S05 (outra conta)', true)
on conflict (id) do nothing;

set local role authenticated;

-- 1) sem módulo nenhum: nega a criação
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000701","user_role":"colaborador","user_modulos":{}}';
select throws_ok(
  $$ select pcm.fn_criar_assessment_pre_venda('00000000-0000-0000-0000-0000000007c1', 'teste') $$,
  '42501',
  null,
  'sem modulo: fn_criar_assessment_pre_venda nega'
);

-- 2) comercial:escrita (SEM pcm): guarda própria libera, mesmo que a RLS de pcm.inspecoes exija pcm
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000702","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';
select is(
  (select motivo_assessment from pcm.fn_criar_assessment_pre_venda('00000000-0000-0000-0000-0000000007c1', 'Levantamento teste S05')),
  'pre_venda',
  'comercial:escrita (sem pcm): fn_criar_assessment_pre_venda cria com motivo pre_venda'
);

select is(
  (select count(*)::int from pcm.inspecoes
    where client_id = '00000000-0000-0000-0000-0000000007c1' and motivo_assessment = 'pre_venda'),
  1,
  'o assessment foi persistido de fato (security definer chegou no insert)'
);

-- ADR-0019 R2: o mesmo usuário comercial NÃO enxerga a tabela por select direto — só pela RPC.
select is(
  (select count(*)::int from pcm.inspecoes where client_id = '00000000-0000-0000-0000-0000000007c1'),
  0,
  'select direto em pcm.inspecoes continua negado pra comercial:escrita (RLS normal, sem RPC)'
);

-- 3) comercial:leitura também lista (fn_listar_assessments_conta aceita leitura OU escrita)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000703","user_role":"colaborador","user_modulos":{"comercial":"leitura"}}';
select is(
  (select count(*)::int from pcm.fn_listar_assessments_conta('00000000-0000-0000-0000-0000000007c1')),
  1,
  'comercial:leitura enxerga o assessment pela RPC de listagem'
);

-- comercial:leitura NÃO consegue criar (fn_criar exige escrita)
select throws_ok(
  $$ select pcm.fn_criar_assessment_pre_venda('00000000-0000-0000-0000-0000000007c1', 'nao deveria') $$,
  '42501',
  null,
  'comercial:leitura nao cria assessment (fn_criar exige escrita)'
);

-- 4) sem módulo nenhum: nega a listagem
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000701","user_role":"colaborador","user_modulos":{}}';
select throws_ok(
  $$ select * from pcm.fn_listar_assessments_conta('00000000-0000-0000-0000-0000000007c1') $$,
  '42501',
  null,
  'sem modulo: fn_listar_assessments_conta nega'
);

-- 5) fn_listar_itens_assessment: mesma guarda, mais o reforço de "mesma Conta"
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000702","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';

select throws_ok(
  $$ select * from pcm.fn_listar_itens_assessment('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000007c1') $$,
  'P0002',
  null,
  'fn_listar_itens_assessment nega quando o assessment nao existe'
);

-- Cria um assessment de teste pra Conta 2 e tenta ler passando o cliente_id da Conta 1 — precisa
-- negar (caso de borda "Assessment de outra Conta").
select id as assessment_conta_2 into temp table t_assessment_conta_2
  from pcm.fn_criar_assessment_pre_venda('00000000-0000-0000-0000-0000000007c2', 'Levantamento Conta 2');

select throws_ok(
  format(
    $$ select * from pcm.fn_listar_itens_assessment(%L, '00000000-0000-0000-0000-0000000007c1') $$,
    (select assessment_conta_2 from t_assessment_conta_2)
  ),
  'P0002',
  null,
  'fn_listar_itens_assessment nega quando o assessment e de OUTRA conta'
);

select is(
  (select count(*)::int from t_assessment_conta_2 ta, lateral pcm.fn_listar_itens_assessment(ta.assessment_conta_2, '00000000-0000-0000-0000-0000000007c2') li),
  0,
  'fn_listar_itens_assessment aceita quando cliente_id bate — levantamento sem item retorna vazio, sem erro'
);

-- 6) sem módulo nenhum: nega a leitura de itens também
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000701","user_role":"colaborador","user_modulos":{}}';
select throws_ok(
  format(
    $$ select * from pcm.fn_listar_itens_assessment(%L, '00000000-0000-0000-0000-0000000007c2') $$,
    (select assessment_conta_2 from t_assessment_conta_2)
  ),
  '42501',
  null,
  'sem modulo: fn_listar_itens_assessment nega'
);

select * from finish();
rollback;
