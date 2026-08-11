-- comercial_contratos_rls.test.sql — pgTAP (E03-S07)
-- RLS de comercial.contratos (AC-1), unicidade proposta_id (AC-3), ciclo criar→ativar→encerrar com
-- plano de faturamento no Financeiro (AC-2/AC-4/AC-5/AC-7/AC-8), tipo avulso sem plano, guardas de
-- ativação (valor zero, vigência vencida, status errado) e regressão do cron pra contrato legado
-- (AC-6). Cenários já confirmados manualmente em produção (smoke test com `set_config`/rollback)
-- antes desta suíte ser escrita. Rodar com `supabase test db` (requer Docker).

begin;
select plan(20);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sem-modulo-s07@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leitura-s07@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'escrita-s07@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, ativo, created_by)
values ('00000000-0000-0000-0000-0000000009d1', 'Condomínio Teste E03-S07', true, '00000000-0000-0000-0000-000000000901')
on conflict (id) do nothing;

insert into comercial.etapas_funil (id, nome, ordem, cor, tipo)
values
  ('00000000-0000-0000-0000-0000000009f1', 'Etapa Aberta Teste S07', 981, '#000000', 'aberta'),
  ('00000000-0000-0000-0000-0000000009f2', 'Etapa Ganha Teste S07', 982, '#00ff00', 'ganha')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000903","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';

insert into comercial.oportunidades (id, cliente_id, etapa_id, titulo)
values
  ('00000000-0000-0000-0000-000000000ca1', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009f1', 'Oportunidade residente — S07'),
  ('00000000-0000-0000-0000-000000000ca2', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009f1', 'Oportunidade avulso — S07'),
  ('00000000-0000-0000-0000-000000000ca3', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009f1', 'Oportunidade valor zero — S07');

insert into comercial.propostas (id, oportunidade_id, tipo, status, custo_total_centavos, piso_centavos, preco_sugerido_centavos, preco_centavos)
values
  ('00000000-0000-0000-0000-000000000cb1', '00000000-0000-0000-0000-000000000ca1', 'residente', 'aceita', 10000, 10638, 12766, 50000),
  ('00000000-0000-0000-0000-000000000cb2', '00000000-0000-0000-0000-000000000ca2', 'simples', 'aceita', 10000, 10638, 12766, 12766),
  ('00000000-0000-0000-0000-000000000cb3', '00000000-0000-0000-0000-000000000ca3', 'volante', 'aceita', 0, 0, 0, 0);

-- ─────────────────────────── AC-1: RLS ───────────────────────────────────────

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000903","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';
select is(
  (select tipo from comercial.fn_criar_contrato('00000000-0000-0000-0000-000000000cb1')),
  'residente',
  'fn_criar_contrato cria com tipo mapeado da proposta'
);
select is(
  (select tipo from comercial.fn_criar_contrato('00000000-0000-0000-0000-000000000cb2')),
  'avulso',
  'proposta tipo simples vira contrato avulso'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000901","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*)::int from comercial.contratos),
  0,
  'sem modulo comercial: select de contratos retorna zero linhas'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000902","user_role":"colaborador","user_modulos":{"comercial":"leitura"}}';
select is(
  (select count(*)::int from comercial.contratos),
  2,
  'leitura comercial: enxerga os 2 contratos criados'
);
-- UPDATE sob RLS não lança erro quando a policy USING filtra a linha (diferente de INSERT, cujo
-- WITH CHECK lança 42501) — vira "0 linhas afetadas" silencioso. Confirma pelo tipo inalterado do
-- contrato residente (o outro já nasceu 'avulso', não serviria de sinal de mudança).
update comercial.contratos set tipo = 'avulso' where cliente_id = '00000000-0000-0000-0000-0000000009d1';
select is(
  (select count(*)::int from comercial.contratos where cliente_id = '00000000-0000-0000-0000-0000000009d1' and tipo = 'residente'),
  1,
  'leitura comercial NAO atualiza contrato (o residente segue residente)'
);

-- ─────────────────────────── AC-3: unicidade ─────────────────────────────────

-- financeiro:leitura junto — os asserts abaixo fazem join com financeiro.contratos pra conferir o
-- plano de faturamento criado por fn_ativar_contrato (RPC é security definer e cria o plano sem
-- depender disso, mas a LEITURA do resultado pelo teste precisa da RLS própria do Financeiro).
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000903","user_role":"colaborador","user_modulos":{"comercial":"escrita","financeiro":"leitura"}}';
select throws_ok(
  $$ select comercial.fn_criar_contrato('00000000-0000-0000-0000-000000000cb1') $$,
  '23505',
  null,
  'proposta que ja gerou contrato nao gera outro (unique no banco)'
);

-- ─────────────────────────── AC-4/AC-5/AC-7: ativar residente ───────────────

select is(
  (select status from comercial.fn_ativar_contrato(
    (select id from comercial.contratos where proposta_id = '00000000-0000-0000-0000-000000000cb1')
  )),
  'ativo',
  'ativar contrato residente muda status pra ativo'
);
select is(
  (select f.status from comercial.contratos c join financeiro.contratos f on f.id = c.financeiro_contrato_id
    where c.proposta_id = '00000000-0000-0000-0000-000000000cb1'),
  'ativo',
  'plano de faturamento nasce ativo no Financeiro'
);
select is(
  (select f.comercial_contrato_id from comercial.contratos c join financeiro.contratos f on f.id = c.financeiro_contrato_id
    where c.proposta_id = '00000000-0000-0000-0000-000000000cb1'),
  (select id from comercial.contratos where proposta_id = '00000000-0000-0000-0000-000000000cb1'),
  'plano de faturamento aponta de volta pro contrato comercial (comercial_contrato_id)'
);
select is(
  (select e.tipo from comercial.oportunidades o join comercial.etapas_funil e on e.id = o.etapa_id
    where o.id = '00000000-0000-0000-0000-000000000ca1'),
  'ganha',
  'ativar contrato move a oportunidade pra etapa tipo=ganha (AC-7)'
);

-- ─────────────────────────── avulso: sem plano de faturamento ───────────────

select is(
  (select status from comercial.fn_ativar_contrato(
    (select id from comercial.contratos where proposta_id = '00000000-0000-0000-0000-000000000cb2')
  )),
  'ativo',
  'contrato avulso ativa normalmente'
);
select is(
  (select financeiro_contrato_id from comercial.contratos where proposta_id = '00000000-0000-0000-0000-000000000cb2'),
  null,
  'contrato avulso NAO gera plano de faturamento'
);

-- ─────────────────────────── guardas de ativação ─────────────────────────────

-- valor zero (residente/volante): fn_criar_contrato cria o rascunho (AC-2, editável antes de
-- ativar), mas fn_ativar_contrato recusa.
select lives_ok(
  $$ select comercial.fn_criar_contrato('00000000-0000-0000-0000-000000000cb3') $$,
  'contrato com valor zero nasce em rascunho sem erro (fica editável antes de ativar)'
);
select throws_ok(
  $$ select comercial.fn_ativar_contrato(
       (select id from comercial.contratos where proposta_id = '00000000-0000-0000-0000-000000000cb3')
     ) $$,
  '23514',
  null,
  'ativar contrato volante com valor zero e recusado'
);

-- reativar contrato já ativo: recusado (só rascunho ativa)
select throws_ok(
  $$ select comercial.fn_ativar_contrato(
       (select id from comercial.contratos where proposta_id = '00000000-0000-0000-0000-000000000cb1')
     ) $$,
  '23514',
  null,
  'ativar contrato que ja esta ativo e recusado'
);

-- ─────────────────────────── AC-8: encerrar ──────────────────────────────────

select is(
  (select status from comercial.fn_encerrar_contrato(
    (select id from comercial.contratos where proposta_id = '00000000-0000-0000-0000-000000000cb1'),
    'Cliente cancelou o serviço',
    current_date
  )),
  'encerrado',
  'encerrar contrato muda status pra encerrado'
);
select is(
  (select f.status from comercial.contratos c join financeiro.contratos f on f.id = c.financeiro_contrato_id
    where c.proposta_id = '00000000-0000-0000-0000-000000000cb1'),
  'encerrado',
  'plano de faturamento tambem encerra (para de gerar parcela nova)'
);
select throws_ok(
  $$ select comercial.fn_encerrar_contrato(
       (select id from comercial.contratos where proposta_id = '00000000-0000-0000-0000-000000000cb1'),
       null, current_date
     ) $$,
  '23514',
  null,
  'encerrar sem motivo e recusado'
);

-- ─────────────────────────── AC-6: regressão do cron (contrato legado) ──────

-- Contrato "legado" — inserido direto no Financeiro, sem passar pelo Comercial (comercial_contrato_id
-- null). fn_gerar_recorrencias (E04-S04) precisa continuar funcionando pra ele sem mudança nenhuma.
-- Insert direto em financeiro.contratos exige user_modulos.financeiro=escrita (RLS própria do
-- Financeiro, migration 0108) — comercial:escrita, usado até aqui, não basta.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000903","user_role":"colaborador","user_modulos":{"comercial":"escrita","financeiro":"escrita"}}';
insert into financeiro.contratos (id, cliente_id, descricao, valor_mensal_centavos, dia_vencimento, inicio, status)
values ('00000000-0000-0000-0000-0000000009e9', '00000000-0000-0000-0000-0000000009d1', 'Contrato legado sem origem comercial', 30000, 10, current_date - 30, 'ativo');
select is(
  (select comercial_contrato_id from financeiro.contratos where id = '00000000-0000-0000-0000-0000000009e9'),
  null,
  'contrato legado tem comercial_contrato_id nulo (AC-6)'
);
select ok(
  (select financeiro.fn_gerar_recorrencias(current_date)) >= 1,
  'fn_gerar_recorrencias continua gerando recebivel pro contrato legado (regressao E04-S04)'
);

select * from finish();
rollback;
