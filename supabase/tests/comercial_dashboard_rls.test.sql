-- comercial_dashboard_rls.test.sql — pgTAP (E03-S08)
-- As 6 RPCs de agregação (migration 0196): sem módulo comercial retorna agregado VAZIO (não erro —
-- security invoker deixa a RLS filtrar), período vazio não divide por zero, oportunidade reaberta
-- usa o último fechamento no ciclo de venda. Cenários já confirmados manualmente em produção
-- (smoke test com dados controlados, matemática conferida) antes desta suíte ser escrita. Rodar com
-- `supabase test db` (requer Docker).

begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sem-modulo-s08@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leitura-s08@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, ativo)
values ('00000000-0000-0000-0000-0000000009b9', 'Condomínio Teste E03-S08', true)
on conflict (id) do nothing;

insert into comercial.etapas_funil (id, nome, ordem, cor, tipo)
values
  ('00000000-0000-0000-0000-0000000009c9', 'Etapa Aberta Teste S08', 971, '#000000', 'aberta'),
  ('00000000-0000-0000-0000-0000000009ca', 'Etapa Ganha Teste S08', 972, '#00ff00', 'ganha')
on conflict (id) do nothing;

set local role authenticated;

-- ─────────────────────────── AC-1: sem módulo, agregado vazio (não erro) ────

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000a01","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*)::int from comercial.fn_conversao_etapas(current_date - 30, current_date)),
  0,
  'sem modulo comercial: fn_conversao_etapas nao levanta erro, so devolve vazio (RLS filtra)'
);
select is(
  (select quantidade from comercial.fn_ciclo_venda(current_date - 30, current_date)),
  0,
  'sem modulo comercial: fn_ciclo_venda devolve quantidade zero'
);

-- ─────────────────────────── AC-9: período vazio não quebra ─────────────────

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000a02","user_role":"colaborador","user_modulos":{"comercial":"leitura"}}';
select is(
  (select mediana_dias from comercial.fn_ciclo_venda(current_date - 30, current_date)),
  null,
  'periodo vazio: mediana null, nunca NaN ou erro de divisao'
);
select is(
  (select desconto_medio_pct from comercial.fn_desconto_medio(current_date - 30, current_date)),
  null,
  'periodo vazio: desconto medio null, nunca 0 fingindo dado real'
);
select is(
  (select ticket_medio_centavos from comercial.fn_ticket_medio(current_date - 30, current_date)),
  null,
  'periodo vazio: ticket medio null'
);
select is(
  (select count(*)::int from comercial.fn_origem_leads(current_date - 30, current_date)),
  0,
  'periodo vazio: origem_leads devolve zero linhas, sem erro'
);

-- ─────────────────────────── oportunidade reaberta usa o último fechamento ──

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000a02","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';

insert into comercial.oportunidades (id, cliente_id, etapa_id, titulo, created_at)
values ('00000000-0000-0000-0000-0000000009d9', '00000000-0000-0000-0000-0000000009b9', '00000000-0000-0000-0000-0000000009c9', '[TESTE S08] Reaberta', now() - interval '40 days');

-- fecha (ganha) há 30 dias
update comercial.oportunidades set etapa_id = '00000000-0000-0000-0000-0000000009ca' where id = '00000000-0000-0000-0000-0000000009d9';
update comercial.oportunidades set fechada_em = now() - interval '30 days' where id = '00000000-0000-0000-0000-0000000009d9';

-- reabre (trigger 0176 zera fechada_em ao voltar pra etapa aberta)
update comercial.oportunidades set etapa_id = '00000000-0000-0000-0000-0000000009c9' where id = '00000000-0000-0000-0000-0000000009d9';
select is(
  (select fechada_em from comercial.oportunidades where id = '00000000-0000-0000-0000-0000000009d9'),
  null,
  'reabrir zera fechada_em (trigger 0176, confere antes do refechamento)'
);

-- fecha de novo (ganha) há 5 dias — este é o "último fechamento" que o ciclo de venda deve usar
update comercial.oportunidades set etapa_id = '00000000-0000-0000-0000-0000000009ca' where id = '00000000-0000-0000-0000-0000000009d9';
update comercial.oportunidades set fechada_em = now() - interval '5 days' where id = '00000000-0000-0000-0000-0000000009d9';

select is(
  (select quantidade from comercial.fn_ciclo_venda(current_date - 10, current_date)),
  1,
  'ciclo de venda conta a oportunidade pelo fechamento MAIS RECENTE (5 dias atras), nao pelo primeiro (30 dias atras, fora desta janela)'
);
select is(
  (select quantidade from comercial.fn_ciclo_venda(current_date - 35, current_date - 20)),
  0,
  'ciclo de venda NAO conta a oportunidade na janela do PRIMEIRO fechamento (ja superado pela reabertura)'
);

select is(
  (select categoria from comercial.fn_win_loss(current_date - 10, current_date) limit 1),
  'ganha',
  'win/loss conta a oportunidade reaberta como ganha, no ultimo fechamento'
);

select * from finish();
rollback;
