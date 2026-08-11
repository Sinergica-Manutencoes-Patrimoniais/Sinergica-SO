-- comercial_portal_proposta_rls.test.sql — pgTAP (E03-S06)
-- Isolamento da view `comercial.portal_propostas` (AC-3/AC-4), idempotência/validade/degradação da
-- RPC `comercial.fn_decidir_proposta` (AC-5/AC-6/AC-7/AC-8). Rodar com `supabase test db` (requer
-- Docker/Supabase local). Cenários já confirmados manualmente em produção (smoke test com
-- `set_config`/rollback) antes desta suíte ser escrita.

begin;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sindico-a-s06@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sindico-b-s06@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'interno-comercial-s06@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, ativo)
values
  ('00000000-0000-0000-0000-0000000009c1', 'Condomínio A — Teste E03-S06', true),
  ('00000000-0000-0000-0000-0000000009c2', 'Condomínio B — Teste E03-S06', true)
on conflict (id) do nothing;

insert into comercial.etapas_funil (id, nome, ordem, cor, tipo)
values
  ('00000000-0000-0000-0000-0000000009e1', 'Etapa Aberta Teste S06', 991, '#000000', 'aberta'),
  ('00000000-0000-0000-0000-0000000009e2', 'Etapa Ganha Teste S06', 992, '#00ff00', 'ganha'),
  ('00000000-0000-0000-0000-0000000009e3', 'Etapa Perdida Teste S06', 993, '#ff0000', 'perdida')
on conflict (id) do nothing;

insert into comercial.motivos_perda (nome) values ('Proposta recusada pelo cliente')
on conflict (nome) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000803","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';

insert into comercial.oportunidades (id, cliente_id, etapa_id, titulo)
values
  ('00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009e1', 'Oportunidade A — S06'),
  ('00000000-0000-0000-0000-0000000009a2', '00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009e1', 'Oportunidade A2 — S06'),
  ('00000000-0000-0000-0000-0000000009a3', '00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009e1', 'Oportunidade A3 (expirada) — S06');

insert into comercial.propostas (id, oportunidade_id, tipo, status, custo_total_centavos, piso_centavos, preco_sugerido_centavos, preco_centavos, valido_ate)
values
  ('00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009a1', 'simples', 'enviada', 10000, 10638, 12766, 12766, current_date + 30),
  ('00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009a2', 'simples', 'enviada', 10000, 10638, 12766, 12766, current_date + 30),
  ('00000000-0000-0000-0000-0000000009b3', '00000000-0000-0000-0000-0000000009a3', 'simples', 'enviada', 10000, 10638, 12766, 12766, current_date - 1),
  ('00000000-0000-0000-0000-0000000009b4', '00000000-0000-0000-0000-0000000009a1', 'simples', 'rascunho', 10000, 10638, 12766, 12766, null);

-- ─────────────────────────── AC-3/AC-4: view portal_propostas ───────────────

-- 1) síndico da Conta certa: enxerga a proposta 'enviada'
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000801","user_role":"cliente-sindico","cliente_id":"00000000-0000-0000-0000-0000000009c1"}';
select is(
  (select count(*)::int from comercial.portal_propostas where id = '00000000-0000-0000-0000-0000000009b1'),
  1,
  'sindico da conta certa enxerga a proposta enviada'
);

-- 2) 'rascunho' nunca aparece no portal, mesmo da própria Conta
select is(
  (select count(*)::int from comercial.portal_propostas where id = '00000000-0000-0000-0000-0000000009b4'),
  0,
  'proposta em rascunho nunca aparece no portal'
);

-- 3) síndico de OUTRA Conta não vê nada
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000802","user_role":"cliente-sindico","cliente_id":"00000000-0000-0000-0000-0000000009c2"}';
select is(
  (select count(*)::int from comercial.portal_propostas),
  0,
  'sindico de outra conta nao ve nenhuma proposta'
);

-- 4) usuário interno (comercial:escrita) não é 'cliente-sindico' — view nega, mesmo enxergando a
-- tabela base normalmente por outro caminho (RLS de comercial.propostas, não desta view).
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000803","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';
select is(
  (select count(*)::int from comercial.portal_propostas),
  0,
  'usuario interno (nao sindico) nao ve nada pela view do portal'
);

-- ─────────────────────────── AC-5/AC-8: aceite + idempotência ───────────────

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000801","user_role":"cliente-sindico","cliente_id":"00000000-0000-0000-0000-0000000009c1"}';

select is(
  (select status from comercial.fn_decidir_proposta('00000000-0000-0000-0000-0000000009b1', 'aceita', null)),
  'aceita',
  'aceite muda o status da proposta pra aceita'
);
select is(
  (select e.tipo from comercial.oportunidades o join comercial.etapas_funil e on e.id = o.etapa_id
    where o.id = '00000000-0000-0000-0000-0000000009a1'),
  'ganha',
  'aceite move a oportunidade pra etapa tipo=ganha'
);
select is(
  (select count(*)::int from comercial.proposta_decisoes where proposta_id = '00000000-0000-0000-0000-0000000009b1'),
  1,
  'grava exatamente 1 decisao'
);
select is(
  (select count(*)::int from comercial.oportunidade_eventos where oportunidade_id = '00000000-0000-0000-0000-0000000009a1'),
  1,
  'grava exatamente 1 evento de movimentacao'
);

-- AC-8: segunda decisão sobre a MESMA proposta é ignorada, sem erro, sem duplicar
select lives_ok(
  $$ select comercial.fn_decidir_proposta('00000000-0000-0000-0000-0000000009b1', 'aceita', null) $$,
  'segunda decisao sobre proposta ja aceita NAO lanca erro (AC-8)'
);
select is(
  (select count(*)::int from comercial.proposta_decisoes where proposta_id = '00000000-0000-0000-0000-0000000009b1'),
  1,
  'segunda decisao nao duplica a linha de decisao'
);

-- ─────────────────────────── AC-6: recusa com motivo ─────────────────────────

select is(
  (select status from comercial.fn_decidir_proposta('00000000-0000-0000-0000-0000000009b2', 'recusada', 'Preço acima do orçamento')),
  'recusada',
  'recusa muda o status da proposta pra recusada'
);
select is(
  (select e.tipo from comercial.oportunidades o join comercial.etapas_funil e on e.id = o.etapa_id
    where o.id = '00000000-0000-0000-0000-0000000009a2'),
  'perdida',
  'recusa move a oportunidade pra etapa tipo=perdida'
);
select throws_ok(
  $$ select comercial.fn_decidir_proposta('00000000-0000-0000-0000-0000000009b1', 'recusada', null) $$,
  '23514',
  null,
  'recusar sem motivo e recusado ANTES de olhar o status da proposta (validacao de entrada primeiro)'
);

-- ─────────────────────────── AC-7: proposta expirada ─────────────────────────

select throws_ok(
  $$ select comercial.fn_decidir_proposta('00000000-0000-0000-0000-0000000009b3', 'aceita', null) $$,
  '23514',
  null,
  'aceitar proposta expirada e recusado no banco'
);

-- ─────────────────────────── guarda: só cliente-sindico ─────────────────────

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000803","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';
select throws_ok(
  $$ select comercial.fn_decidir_proposta('00000000-0000-0000-0000-0000000009b3', 'aceita', null) $$,
  '42501',
  null,
  'usuario interno (nao cliente-sindico) nao decide proposta'
);

select * from finish();
rollback;
