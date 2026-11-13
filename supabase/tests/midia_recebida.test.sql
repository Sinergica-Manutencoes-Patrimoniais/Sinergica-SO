-- midia_recebida.test.sql — pgTAP (E02-S37)
-- Ingestão de mídia/aviso via fn_registrar_midia_evolution, CHECKs que restringem os campos novos
-- ao cliente. Rodar com `supabase test db`.

begin;
select plan(6);

insert into atendimento.canais_externos (id, tipo, label, identificador_externo, ativo)
values ('00000000-0000-0000-0000-000000000371', 'evolution', 'Canal S37', 'inst-s37', true)
on conflict (id) do nothing;

-- 1: imagem guardada grava midia_url/midia_nome/midia_mime e o texto para o Zé
select ok(
  (select not duplicado from atendimento.fn_registrar_midia_evolution(
    '00000000-0000-0000-0000-000000000371', 'MESSAGES_UPSERT', 'MIDIA-1', 'inst-s37',
    '5511977777777@s.whatsapp.net', 'midia', 'imagem', 'paguei a avaliação',
    '[imagem] legenda: paguei a avaliação',
    'canal/MIDIA-1/foto.jpg', 'foto.jpg', 'image/jpeg', 'guardado'
  )),
  'imagem guardada registra com sucesso'
);

select is(
  (select midia_url from atendimento.mensagens where wa_message_id = 'MIDIA-1'),
  'canal/MIDIA-1/foto.jpg',
  'midia_url grava o caminho no bucket (reusa coluna de 0063)'
);

-- 2: reentrega do mesmo evento é duplicada (mesma reserva de inbox de 1848)
select ok(
  (select duplicado from atendimento.fn_registrar_midia_evolution(
    '00000000-0000-0000-0000-000000000371', 'MESSAGES_UPSERT', 'MIDIA-1', 'inst-s37',
    '5511977777777@s.whatsapp.net', 'midia', 'imagem', 'paguei a avaliação',
    '[imagem] legenda: paguei a avaliação',
    'canal/MIDIA-1/foto.jpg', 'foto.jpg', 'image/jpeg', 'guardado'
  )),
  'reentrega do mesmo (canal, evento, id) é duplicada'
);

-- 3: aviso vira texto, sem midia_url
select is(
  (select tipo_conteudo from atendimento.fn_registrar_midia_evolution(
    '00000000-0000-0000-0000-000000000371', 'MESSAGES_UPSERT', 'MIDIA-2', 'inst-s37',
    '5511988888888@s.whatsapp.net', 'texto', 'localizacao', null, '[localização]',
    null, null, null, null
  ) f join atendimento.mensagens m on m.id = f.mensagem_id),
  'texto',
  'aviso de localização vira mensagem de texto, sem anexo'
);

-- 4: CHECK recusa legenda em mensagem da EQUIPE (direcao=saida)
select throws_ok(
  $$ insert into atendimento.mensagens (conversa_id, direcao, remetente_tipo, tipo_conteudo, legenda)
     select id, 'saida', 'humano', 'midia', 'legenda de equipe nao pode'
       from atendimento.conversas limit 1 $$,
  '23514',
  null,
  'CHECK recusa legenda em mensagem que não é de entrada do cliente'
);

-- 5: CHECK recusa anexo_estado=guardado sem tipo_conteudo compatível
select throws_ok(
  $$ insert into atendimento.mensagens (conversa_id, direcao, remetente_tipo, tipo_conteudo, anexo_estado)
     select id, 'entrada', 'cliente', 'texto', 'guardado'
       from atendimento.conversas limit 1 $$,
  '23514',
  null,
  'CHECK recusa anexo_estado=guardado com tipo_conteudo=texto'
);

select * from finish();
rollback;
