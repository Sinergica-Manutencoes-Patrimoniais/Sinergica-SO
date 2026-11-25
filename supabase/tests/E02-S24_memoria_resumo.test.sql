-- E02-S24_memoria_resumo.test.sql — pgTAP (E02-S24, migration 1880)
-- Prova as três coisas que o job de resumo rolante depende do banco para garantir:
--   AC-3: só entra no resumo o que JÁ SAIU da janela crua e ainda está dentro da retenção;
--   AC-4: isolamento — a transcrição de um cliente nunca traz mensagem de outro (requisito de
--         SEGURANÇA, por isso o recorte é SQL e não TypeScript);
--   a fila só devolve cliente cujo resumo está desatualizado (não refaz resumo à toa, que é
--   chamada de LLM paga).
-- Rodar com `supabase test db supabase/tests/E02-S24_memoria_resumo.test.sql` (requer Docker).

begin;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('e0240000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'memoria-resumo@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, ativo, created_by) values
  ('e0240000-0000-4000-8000-0000000000c1', 'Condomínio Alfa (S24)', true, 'e0240000-0000-4000-8000-00000000000a'),
  ('e0240000-0000-4000-8000-0000000000c2', 'Condomínio Beta (S24)', true, 'e0240000-0000-4000-8000-00000000000a')
on conflict (id) do nothing;

insert into atendimento.conversas (id, client_id, instance_id, remote_jid, created_by) values
  ('e0240000-0000-4000-8000-0000000000f1', 'e0240000-0000-4000-8000-0000000000c1', 'inst-s24', '5511000000001@g.us', 'e0240000-0000-4000-8000-00000000000a'),
  ('e0240000-0000-4000-8000-0000000000f2', 'e0240000-0000-4000-8000-0000000000c2', 'inst-s24', '5511000000002@g.us', 'e0240000-0000-4000-8000-00000000000a')
on conflict (id) do nothing;

-- Alfa: uma na janela crua (2 dias), uma no resumo (45 dias), uma fora da retenção (200 dias).
insert into atendimento.mensagens (conversa_id, direcao, remetente_tipo, conteudo, created_at) values
  ('e0240000-0000-4000-8000-0000000000f1', 'entrada', 'cliente', 'ALFA_JANELA_CRUA bomba parou hoje',   now() - interval '2 days'),
  ('e0240000-0000-4000-8000-0000000000f1', 'entrada', 'cliente', 'ALFA_RESUMO vazamento no 3o andar',   now() - interval '45 days'),
  ('e0240000-0000-4000-8000-0000000000f1', 'saida',   'humano',  'ALFA_RESUMO_ATENDENTE equipe a caminho', now() - interval '44 days'),
  ('e0240000-0000-4000-8000-0000000000f1', 'entrada', 'cliente', 'ALFA_FORA_DA_RETENCAO assunto antigo', now() - interval '200 days'),
  ('e0240000-0000-4000-8000-0000000000f1', 'entrada', 'cliente', '   ',                                  now() - interval '46 days');

-- Beta: só mensagem na faixa de resumo — serve de "outro cliente" para o teste de isolamento.
insert into atendimento.mensagens (conversa_id, direcao, remetente_tipo, conteudo, created_at) values
  ('e0240000-0000-4000-8000-0000000000f2', 'entrada', 'cliente', 'BETA_SEGREDO elevador social', now() - interval '50 days');

-- ── AC-4: isolamento ──────────────────────────────────────────────────────────────────────────
select is(
  (select count(*)::int from atendimento.fn_mensagens_para_resumo_memoria('e0240000-0000-4000-8000-0000000000c1')
    where conteudo like 'BETA%'),
  0,
  'AC-4: transcrição do Alfa não traz nenhuma mensagem do Beta'
);

select is(
  (select count(*)::int from atendimento.fn_mensagens_para_resumo_memoria('e0240000-0000-4000-8000-0000000000c2')
    where conteudo like 'ALFA%'),
  0,
  'AC-4: transcrição do Beta não traz nenhuma mensagem do Alfa'
);

select is(
  (select count(*)::int from atendimento.fn_mensagens_para_resumo_memoria(null)),
  0,
  'AC-4: cliente nulo não devolve nada (não existe caminho "todos os clientes")'
);

-- ── AC-3: recorte da janela ───────────────────────────────────────────────────────────────────
select is(
  (select count(*)::int from atendimento.fn_mensagens_para_resumo_memoria('e0240000-0000-4000-8000-0000000000c1')
    where conteudo like 'ALFA_JANELA_CRUA%'),
  0,
  'AC-3: o que o Zé já lê cru (últimos 30 dias) não entra no resumo'
);

select is(
  (select count(*)::int from atendimento.fn_mensagens_para_resumo_memoria('e0240000-0000-4000-8000-0000000000c1')
    where conteudo like 'ALFA_FORA_DA_RETENCAO%'),
  0,
  'AC-3: mensagem além da retenção (90 dias) não entra no resumo'
);

select is(
  (select count(*)::int from atendimento.fn_mensagens_para_resumo_memoria('e0240000-0000-4000-8000-0000000000c1')),
  2,
  'AC-3: sobram exatamente as 2 mensagens com conteúdo entre 30 e 90 dias (vazia descartada)'
);

-- ── Fila do job ───────────────────────────────────────────────────────────────────────────────
select ok(
  exists (select 1 from atendimento.fn_clientes_para_resumo_memoria(30, 90, 50)
           where cliente_id = 'e0240000-0000-4000-8000-0000000000c1'),
  'cliente sem resumo nenhum entra na fila do job'
);

insert into atendimento.cliente_memoria_resumo (cliente_id, resumo, periodo_inicio, periodo_fim)
values ('e0240000-0000-4000-8000-0000000000c1', 'resumo vigente', now() - interval '90 days', now() - interval '30 days')
on conflict (cliente_id) do update set periodo_fim = excluded.periodo_fim;

select ok(
  not exists (select 1 from atendimento.fn_clientes_para_resumo_memoria(30, 90, 50)
               where cliente_id = 'e0240000-0000-4000-8000-0000000000c1'),
  'cliente com resumo já cobrindo a faixa sai da fila (não refaz chamada de LLM à toa)'
);

select * from finish();
rollback;
