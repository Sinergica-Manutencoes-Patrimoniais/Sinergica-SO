-- relacionamento_contatos_timeline.test.sql — pgTAP (E02-S08)
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

insert into comercial.leads (
  id, nome, telefone, origem, status, score, resumo, conversa_id, contato_id, origem_ref, created_by
)
select
  '3a000000-0000-0000-0000-000000000001',
  'Ana Relacionamento',
  '5511999990000',
  'whatsapp',
  'qualificado',
  88,
  'Orçamento de manutenção predial.',
  c.id,
  c.contato_id,
  c.remote_jid,
  '00000000-0000-0000-0000-0000000003a1'
from atendimento.conversas c
where c.instance_id = 'inst-rel' and c.remote_jid = '5511999990000@s.whatsapp.net';

update atendimento.conversas
set lead_id = '3a000000-0000-0000-0000-000000000001'
where instance_id = 'inst-rel' and remote_jid = '5511999990000@s.whatsapp.net';

insert into relacionamento.vinculos (contato_id, entidade_tipo, entidade_id, papel, principal)
select contato_id, 'comercial_lead', '3a000000-0000-0000-0000-000000000001', 'lead', true
from atendimento.conversas
where instance_id = 'inst-rel' and remote_jid = '5511999990000@s.whatsapp.net';

select is(
  (select l.contato_id from comercial.leads l where l.id = '3a000000-0000-0000-0000-000000000001'),
  (select c.contato_id from atendimento.conversas c where c.instance_id = 'inst-rel' and c.remote_jid = '5511999990000@s.whatsapp.net'),
  'lead aponta para o mesmo contato da conversa'
);

select is(
  (select count(*)::int from relacionamento.vinculos where entidade_tipo = 'comercial_lead' and entidade_id = '3a000000-0000-0000-0000-000000000001'),
  1,
  'vinculo contato->lead criado'
);

select ok(
  exists (
    select 1
    from relacionamento.get_timeline_contato(
      (select contato_id from comercial.leads where id = '3a000000-0000-0000-0000-000000000001'),
      20
    )
    where evento_tipo = 'lead'
  ),
  'timeline inclui lead'
);

select ok(
  exists (
    select 1
    from relacionamento.get_timeline_contato(
      (select contato_id from comercial.leads where id = '3a000000-0000-0000-0000-000000000001'),
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
