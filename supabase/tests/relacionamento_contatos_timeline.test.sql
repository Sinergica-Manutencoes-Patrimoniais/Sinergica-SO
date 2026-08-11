-- relacionamento_contatos_timeline.test.sql — pgTAP (E02-S08, atualizado na E03-S10)
-- A seção de "lead" (linhas ~45 em diante) foi reescrita na E03-S10: `comercial.leads` foi
-- dropada, o fluxo real hoje é `comercial.fn_registrar_oportunidade` (E03-S09) + timeline lendo de
-- `comercial.oportunidades`. Resolução de contato via webhook, identidade normalizada e dedup
-- (primeira metade) continuam intactos, sem relação com a mudança.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'relacionamento-escrita@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role service_role;

select atendimento.fn_registrar_mensagem_entrada(
  'inst-rel',
  '5511999990000@s.whatsapp.net',
  'Ana Relacionamento',
  'olá, quero orçamento',
  'rel-msg-001'
);

select isnt(
  (select contato_id from atendimento.conversas where instance_id = 'inst-rel' and remote_jid = '5511999990000@s.whatsapp.net'),
  null,
  'webhook resolve contato_id na conversa'
);

select is(
  (select count(*)::int from relacionamento.identidades_contato where tipo = 'whatsapp' and valor_normalizado = '5511999990000@s.whatsapp.net'),
  1,
  'cria identidade whatsapp normalizada'
);

select atendimento.fn_registrar_mensagem_entrada(
  'inst-rel',
  '5511999990000@s.whatsapp.net',
  'Ana Relacionamento',
  'olá, quero orçamento',
  'rel-msg-001'
);

select is(
  (select count(*)::int from relacionamento.contatos),
  1,
  'reentrega da mesma identidade nao duplica contato'
);

-- E03-S10: o caminho real hoje é a RPC do Comercial (E03-S09), não insert direto em
-- comercial.leads (dropada). `set local role service_role` já satisfaz a guarda da RPC
-- (current_setting('role', true) = 'service_role').
insert into comercial.etapas_funil (id, nome, ordem, cor, tipo)
values ('3a000000-0000-0000-0000-0000000000e1', 'Etapa Teste Timeline', 998, '#000000', 'aberta')
on conflict (id) do nothing;

select comercial.fn_registrar_oportunidade(
  'Ana Relacionamento',
  '5511999990000',
  88,
  'Orçamento de manutenção predial.',
  '5511999990000@s.whatsapp.net',
  'A',
  null,
  (select id from atendimento.conversas where instance_id = 'inst-rel' and remote_jid = '5511999990000@s.whatsapp.net'),
  (select contato_id from atendimento.conversas where instance_id = 'inst-rel' and remote_jid = '5511999990000@s.whatsapp.net'),
  '00000000-0000-0000-0000-0000000003a1'
);

select is(
  (
    select o.contato_id from comercial.oportunidades o
     where o.conversa_id = (select id from atendimento.conversas where instance_id = 'inst-rel' and remote_jid = '5511999990000@s.whatsapp.net')
  ),
  (select c.contato_id from atendimento.conversas c where c.instance_id = 'inst-rel' and c.remote_jid = '5511999990000@s.whatsapp.net'),
  'oportunidade aponta para o mesmo contato da conversa'
);

select is(
  (
    select count(*)::int from relacionamento.vinculos v
     where v.contato_id = (select contato_id from atendimento.conversas where instance_id = 'inst-rel' and remote_jid = '5511999990000@s.whatsapp.net')
       and v.entidade_tipo = 'pcm_cliente'
  ),
  1,
  'vinculo contato->Conta criado automaticamente pela RPC (AC-2 da S09)'
);

select ok(
  exists (
    select 1
    from relacionamento.get_timeline_contato(
      (select contato_id from atendimento.conversas where instance_id = 'inst-rel' and remote_jid = '5511999990000@s.whatsapp.net'),
      20
    )
    where evento_tipo = 'lead'
  ),
  'timeline inclui a oportunidade como evento tipo lead (lida de comercial.oportunidades, pos-S10)'
);

select ok(
  exists (
    select 1
    from relacionamento.get_timeline_contato(
      (select contato_id from atendimento.conversas where instance_id = 'inst-rel' and remote_jid = '5511999990000@s.whatsapp.net'),
      20
    )
    where evento_tipo = 'mensagem'
  ),
  'timeline inclui mensagem'
);

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003a1","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*)::int from relacionamento.contatos),
  0,
  'sem modulo pcm/atendimento/comercial nao ve contatos'
);
reset role;

select * from finish();
rollback;
