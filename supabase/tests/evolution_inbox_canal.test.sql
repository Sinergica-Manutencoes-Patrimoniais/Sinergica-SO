-- evolution_inbox_canal.test.sql — pgTAP (E02-S36)
-- Idempotência por canal: reentrega do mesmo (canal, evento, id) não duplica mensagem.
-- SPEC_DEVIATION (ver 1848): wa_message_id segue com unicidade GLOBAL, não por canal — um
-- remote_id colidindo entre dois canais diferentes (teórico, Baileys inclui aleatoriedade por
-- dispositivo no id) faz a segunda mensagem ser descartada pelo ON CONFLICT DO NOTHING global.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(7);

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

-- 3: remote_id DIFERENTE em canal diferente registra normalmente (inbox é escopado por canal)
select ok(
  (select not duplicado from atendimento.fn_registrar_mensagem_evolution(
    '00000000-0000-0000-0000-000000000362', 'MESSAGES_UPSERT', 'REMOTE-2',
    'inst-b-s36', '5511900000002@s.whatsapp.net', 'Ciclana', 'oi de outro canal'
  )),
  'remote_id diferente em canal diferente registra (não duplicado)'
);

-- 4: SPEC_DEVIATION — mesmo remote_id em canal diferente COLIDE na unicidade global de
-- wa_message_id; a reserva no inbox (escopada por canal) ainda passa, mas o INSERT em
-- mensagens é descartado pelo ON CONFLICT DO NOTHING, e nenhuma segunda mensagem nasce.
select ok(
  (select not duplicado from atendimento.fn_registrar_mensagem_evolution(
    '00000000-0000-0000-0000-000000000362', 'MESSAGES_UPSERT', 'REMOTE-1',
    'inst-b-s36', '5511900000004@s.whatsapp.net', 'Beltrano', 'oi colidindo com canal A'
  )),
  'inbox reserva por canal mesmo quando wa_message_id colide globalmente (duplicado=false na reserva)'
);
select is(
  (select count(*)::int from atendimento.mensagens where wa_message_id = 'REMOTE-1'),
  1,
  'wa_message_id colidindo entre canais não cria segunda mensagem (unicidade global, SPEC_DEVIATION)'
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
       '00000000-0000-0000-0000-000000000361', 'MESSAGES_UPSERT', 'REMOTE-3',
       'inst-a-s36', '5511900000003@s.whatsapp.net', null, 'oi') $$,
  '42501',
  null,
  'authenticated não executa fn_registrar_mensagem_evolution'
);

select * from finish();
rollback;
