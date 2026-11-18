-- citacao_e_reacao.test.sql — pgTAP (E02-S38)
-- Citação resolvida dentro do canal, reação aplicada/removida/órfã, uma por mensagem, RLS.
-- Rodar com `supabase test db`.

begin;
select plan(8);

insert into atendimento.canais_externos (id, tipo, label, identificador_externo, ativo)
values ('00000000-0000-0000-0000-000000000381', 'evolution', 'Canal S38', 'inst-s38', true)
on conflict (id) do nothing;

-- mensagem original (vai ser citada/reagida)
select atendimento.fn_registrar_mensagem_evolution(
  '00000000-0000-0000-0000-000000000381', 'MESSAGES_UPSERT', 'ORIGINAL-1', 'inst-s38',
  '5511966666666@s.whatsapp.net', 'Fulano', 'a sessão custa R$ 500'
);

-- 1: resposta citando resolve citada_mensagem_id e citada_autor
select atendimento.fn_registrar_mensagem_evolution(
  '00000000-0000-0000-0000-000000000381', 'MESSAGES_UPSERT', 'RESPOSTA-1', 'inst-s38',
  '5511966666666@s.whatsapp.net', 'Fulano', 'é por sessão?', 'ORIGINAL-1'
);
select is(
  (select citada_autor from atendimento.mensagens where wa_message_id = 'RESPOSTA-1'),
  'cliente',
  'citação resolvida: autor da mensagem original'
);
select isnt(
  (select citada_mensagem_id from atendimento.mensagens where wa_message_id = 'RESPOSTA-1'),
  null,
  'citada_mensagem_id resolvido dentro do canal'
);

-- 2: citação de mensagem que não está no sistema fica 'desconhecido', sem id
select atendimento.fn_registrar_mensagem_evolution(
  '00000000-0000-0000-0000-000000000381', 'MESSAGES_UPSERT', 'RESPOSTA-2', 'inst-s38',
  '5511966666666@s.whatsapp.net', 'Fulano', 'e esse outro valor?', 'NAO-EXISTE-NO-SISTEMA'
);
select is(
  (select citada_autor from atendimento.mensagens where wa_message_id = 'RESPOSTA-2'),
  'desconhecido',
  'citação de mensagem fora do sistema vira desconhecido'
);
select is(
  (select citada_mensagem_id from atendimento.mensagens where wa_message_id = 'RESPOSTA-2'),
  null,
  'sem mensagem_id quando a citada não está no sistema'
);

-- 3: reação aplicada
select is(
  (select atendimento.fn_registrar_reacao_evolution(
    '00000000-0000-0000-0000-000000000381', 'ORIGINAL-1', '👍')),
  'aplicada',
  'reação aplicada na mensagem existente'
);

-- 4: trocar o emoji substitui, não duplica (upsert por mensagem_id)
select atendimento.fn_registrar_reacao_evolution('00000000-0000-0000-0000-000000000381', 'ORIGINAL-1', '❤️');
select is(
  (select count(*)::int from atendimento.reacoes_mensagem m
     join atendimento.mensagens msg on msg.id = m.mensagem_id
    where msg.wa_message_id = 'ORIGINAL-1'),
  1,
  'uma só linha de reação por mensagem (trocar substitui)'
);

-- 5: remover (emoji vazio) apaga a linha
select atendimento.fn_registrar_reacao_evolution('00000000-0000-0000-0000-000000000381', 'ORIGINAL-1', '');
select is(
  (select count(*)::int from atendimento.reacoes_mensagem m
     join atendimento.mensagens msg on msg.id = m.mensagem_id
    where msg.wa_message_id = 'ORIGINAL-1'),
  0,
  'emoji vazio remove a reação'
);

-- 6: reação órfã (mensagem não existe) não gera erro
select is(
  (select atendimento.fn_registrar_reacao_evolution(
    '00000000-0000-0000-0000-000000000381', 'NAO-EXISTE', '👍')),
  'orfa',
  'reação a mensagem inexistente é órfã, sem erro'
);

select * from finish();
rollback;
