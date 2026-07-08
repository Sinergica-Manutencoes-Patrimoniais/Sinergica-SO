-- atendimento_registrar_mensagem_rpc.test.sql — pgTAP (E02-S01)
-- Prova que atendimento.fn_registrar_mensagem_entrada é idempotente por wa_message_id: uma
-- reentrega da MESMA mensagem (retry de rede do Evolution) não infla nao_lidas nem duplica a
-- linha em mensagens. Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(4);

set local role service_role;

select atendimento.fn_registrar_mensagem_entrada('inst-rpc', 'jid-rpc@g.us', 'Síndico Teste', 'primeira mensagem', 'wamsg-001');

select is(
  (select nao_lidas from atendimento.conversas where instance_id = 'inst-rpc' and remote_jid = 'jid-rpc@g.us'),
  1,
  'primeira chamada incrementa nao_lidas para 1'
);

-- Reentrega da MESMA mensagem (mesmo wa_message_id) — não deve incrementar de novo.
select atendimento.fn_registrar_mensagem_entrada('inst-rpc', 'jid-rpc@g.us', 'Síndico Teste', 'primeira mensagem', 'wamsg-001');

select is(
  (select nao_lidas from atendimento.conversas where instance_id = 'inst-rpc' and remote_jid = 'jid-rpc@g.us'),
  1,
  'reentrega da mesma wa_message_id NAO infla nao_lidas (idempotente)'
);
select is(
  (select count(*)::int from atendimento.mensagens where wa_message_id = 'wamsg-001'),
  1,
  'reentrega NAO duplica a linha em mensagens'
);

-- Mensagem genuinamente nova na mesma conversa incrementa normalmente.
select atendimento.fn_registrar_mensagem_entrada('inst-rpc', 'jid-rpc@g.us', 'Síndico Teste', 'segunda mensagem', 'wamsg-002');

select is(
  (select nao_lidas from atendimento.conversas where instance_id = 'inst-rpc' and remote_jid = 'jid-rpc@g.us'),
  2,
  'mensagem genuinamente nova incrementa nao_lidas normalmente'
);

reset role;

select * from finish();
rollback;
