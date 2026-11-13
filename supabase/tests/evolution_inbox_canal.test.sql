-- evolution_inbox_canal.test.sql — pgTAP (E02-S36, AC-5)
-- Idempotência por canal: mesmo remote_id em canais diferentes NÃO colide; duplicata no mesmo
-- canal não duplica mensagem. Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(6);

insert into atendimento.canais_externos (id, tipo, label, identificador_externo, ativo)
values
  ('00000000-0000-0000-0000-000000000361', 'evolution', 'Canal A S36', 'inst-a-s36', true),
  ('00000000-0000-0000-0000-000000000362', 'evolution', 'Canal B S36', 'inst-b-s36', true)
on conflict (id) do nothing;

-- 1: primeira entrega registra
select ok(
  (select not duplicado from atendimento.fn_registrar_mensagem_evolution(
    '00000000-0000-0000-0000-000000000361', 'MESSAGES_UPSERT', 'REMOTE-1',
    'inst-a-s36', '5511900000001@s.whatsapp.net', 'Fulano', 'oi'
  )),
  'primeira entrega no canal A registra (não duplicado)'
);

-- 2: reentrega do MESMO evento no MESMO canal é duplicada
select ok(
  (select duplicado from atendimento.fn_registrar_mensagem_evolution(
    '00000000-0000-0000-0000-000000000361', 'MESSAGES_UPSERT', 'REMOTE-1',
    'inst-a-s36', '5511900000001@s.whatsapp.net', 'Fulano', 'oi'
  )),
  'reentrega do mesmo (canal, evento, id) é duplicada'
);

-- 3: MESMO remote_id em CANAL DIFERENTE não é duplicado (AC-5)
select ok(
  (select not duplicado from atendimento.fn_registrar_mensagem_evolution(
    '00000000-0000-0000-0000-000000000362', 'MESSAGES_UPSERT', 'REMOTE-1',
    'inst-b-s36', '5511900000002@s.whatsapp.net', 'Ciclana', 'oi de outro canal'
  )),
  'mesmo remote_id em canal diferente NÃO colide'
);

-- 4: cada canal gerou sua própria conversa/mensagem (sem cruzar)
select is(
  (select count(distinct conversa_id)::int from atendimento.mensagens
    where wa_message_id = 'REMOTE-1'),
  2,
  'duas conversas distintas para o mesmo remote_id em canais diferentes'
);

-- 5: conversa nova já nasce com canal_id preenchido
select is(
  (select canal_id from atendimento.conversas where remote_jid = '5511900000001@s.whatsapp.net'),
  '00000000-0000-0000-0000-000000000361'::uuid,
  'conversa nova carrega canal_id do webhook (nunca do corpo do evento)'
);

-- 6: service_role é o único que executa a RPC
set local role authenticated;

select throws_ok(
  $$ select atendimento.fn_registrar_mensagem_evolution(
       '00000000-0000-0000-0000-000000000361', 'MESSAGES_UPSERT', 'REMOTE-2',
       'inst-a-s36', '5511900000003@s.whatsapp.net', null, 'oi') $$,
  '42501',
  null,
  'authenticated não executa fn_registrar_mensagem_evolution'
);

select * from finish();
rollback;
