-- E02-S25_trigger_automatico.test.sql — pgTAP (E02-S25, migration 1881)
-- Prova as duas respostas que destravaram a task 5 e as duas travas portadas do TriviAtende:
--   AC-2/AC-4: "última resposta humana" vem de `origem_envio in ('formulario','celular')` — IA e
--              automática do WhatsApp Business NÃO contam (senão o Zé fica mudo esperando um
--              humano que nunca falou, ou responde por cima de quem está atendendo);
--   AC-3:      humano assumir a conversa CANCELA o que o Zé tinha agendado na fila;
--   AC-6:      janela por dia da semana, com as invariantes do horário.
-- Rodar com `supabase test db supabase/tests/E02-S25_trigger_automatico.test.sql`.

begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('e0250000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'trigger-automatico@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, ativo, created_by)
values ('e0250000-0000-4000-8000-0000000000c1', 'Condomínio Gama (S25)', true, 'e0250000-0000-4000-8000-00000000000a')
on conflict (id) do nothing;

insert into atendimento.conversas (id, client_id, instance_id, remote_jid, created_by)
values ('e0250000-0000-4000-8000-0000000000f1', 'e0250000-0000-4000-8000-0000000000c1', 'inst-s25', '5511000000025@g.us', 'e0250000-0000-4000-8000-00000000000a')
on conflict (id) do nothing;

-- ── AC-2: sem resposta humana nenhuma ─────────────────────────────────────────────────────────
select is(
  atendimento.fn_minutos_sem_resposta_humana('e0250000-0000-4000-8000-0000000000f1'),
  null,
  'AC-2: conversa sem resposta humana devolve NULL (o chamador silencia, conservador)'
);

-- Respostas que NÃO são humanas: o próprio Zé e a automática do WhatsApp Business (E02-S39).
insert into atendimento.mensagens (conversa_id, direcao, remetente_tipo, origem_envio, conteudo, created_at) values
  ('e0250000-0000-4000-8000-0000000000f1', 'saida', 'ze',     'ia',                 'resposta do Zé',        now() - interval '5 minutes'),
  ('e0250000-0000-4000-8000-0000000000f1', 'saida', 'humano', 'celular_automatico', 'Obrigado pelo contato', now() - interval '4 minutes');

select is(
  atendimento.fn_minutos_sem_resposta_humana('e0250000-0000-4000-8000-0000000000f1'),
  null,
  'AC-4: resposta da IA e automática do aparelho não contam como atendimento humano'
);

insert into atendimento.mensagens (conversa_id, direcao, remetente_tipo, origem_envio, conteudo, created_at)
values ('e0250000-0000-4000-8000-0000000000f1', 'saida', 'humano', 'formulario', 'já estou vendo', now() - interval '40 minutes');

select is(
  atendimento.fn_minutos_sem_resposta_humana('e0250000-0000-4000-8000-0000000000f1'),
  40,
  'AC-2: resposta pelo Inbox (formulario) conta — 40 minutos'
);

insert into atendimento.mensagens (conversa_id, direcao, remetente_tipo, origem_envio, conteudo, created_at)
values ('e0250000-0000-4000-8000-0000000000f1', 'saida', 'humano', 'celular', 'estou a caminho', now() - interval '3 minutes');

select is(
  atendimento.fn_minutos_sem_resposta_humana('e0250000-0000-4000-8000-0000000000f1'),
  3,
  'AC-4: resposta pelo celular do atendente também conta, e vale a mais recente'
);

select is(
  atendimento.fn_minutos_sem_resposta_humana(null),
  null,
  'conversa nula não devolve nada'
);

-- ── AC-3: humano assumiu cancela o agendado ───────────────────────────────────────────────────
insert into atendimento.wa_queue (id, queue_key, wait_until, status) values
  ('e0250000-0000-4000-8000-0000000000a1', 'inst-s25:5511000000025@g.us', now() + interval '20 minutes', 'pending'),
  ('e0250000-0000-4000-8000-0000000000a2', 'inst-s25:5511000000025@g.us', now() - interval '1 day',      'done');

update atendimento.conversas
   set modo = 'pausado'
 where id = 'e0250000-0000-4000-8000-0000000000f1';

select is(
  (select status from atendimento.wa_queue where id = 'e0250000-0000-4000-8000-0000000000a1'),
  'skipped',
  'AC-3: handoff (modo=pausado) cancela o item que o Zé tinha agendado'
);

select is(
  (select status from atendimento.wa_queue where id = 'e0250000-0000-4000-8000-0000000000a2'),
  'done',
  'item já finalizado não é tocado pelo cancelamento'
);

-- ── AC-6: janela por dia ──────────────────────────────────────────────────────────────────────
insert into atendimento.personas (id, nome, tipo, prompt_sistema, ativo, created_by)
values ('e0250000-0000-4000-8000-0000000000b1', 'Zé (teste S25)', 'chamados', 'prompt', true, 'e0250000-0000-4000-8000-00000000000a')
on conflict (id) do nothing;

insert into atendimento.persona_janela_automatica (persona_id, dia_semana, inicio, fim)
values ('e0250000-0000-4000-8000-0000000000b1', 6, '08:00', '12:00');

select throws_ok(
  $$insert into atendimento.persona_janela_automatica (persona_id, dia_semana, inicio, fim)
    values ('e0250000-0000-4000-8000-0000000000b1', 6, '08:00', '18:00')$$,
  '23505',
  null,
  'AC-6: um dia da semana não pode ter duas janelas na mesma persona'
);

select throws_ok(
  $$insert into atendimento.persona_janela_automatica (persona_id, dia_semana, inicio, fim)
    values ('e0250000-0000-4000-8000-0000000000b1', 3, '18:00', '08:00')$$,
  '23514',
  null,
  'AC-6: fim antes do início é recusado pelo banco, não só pela tela'
);

select * from finish();
rollback;
