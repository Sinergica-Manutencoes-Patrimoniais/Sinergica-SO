-- atendimento_mensagens_rls.test.sql — pgTAP (E02-S01, AC-7)
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000351', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-leitura-s01b@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000352', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-escrita-s01b@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role service_role;
insert into atendimento.conversas (id, instance_id, remote_jid, created_by)
values ('35000000-0000-0000-0000-000000000001', 'inst-1', 'jid-s01b@g.us', '00000000-0000-0000-0000-000000000352');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000351","user_role":"colaborador","user_modulos":{"atendimento":"leitura"}}';
select throws_ok(
  $$ insert into atendimento.mensagens (conversa_id, direcao, remetente_tipo, conteudo) values ('35000000-0000-0000-0000-000000000001', 'saida', 'humano', 'negado') $$,
  '42501',
  null,
  'atendimento leitura NAO insere mensagens'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000352","user_role":"colaborador","user_modulos":{"atendimento":"escrita"}}';
select lives_ok(
  $$ insert into atendimento.mensagens (id, conversa_id, direcao, remetente_tipo, remetente_id, conteudo, status_entrega) values ('35000000-0000-0000-0000-000000000002', '35000000-0000-0000-0000-000000000001', 'saida', 'humano', '00000000-0000-0000-0000-000000000352', 'oi, posso ajudar?', 'enviando') $$,
  'atendimento escrita insere mensagem humana'
);
select lives_ok(
  $$ update atendimento.mensagens set status_entrega = 'enviado' where id = '35000000-0000-0000-0000-000000000002' $$,
  'atendimento escrita atualiza status_entrega'
);
reset role;

-- Sem o módulo `atendimento`, o SELECT é permitido a nível de ACL mas a policy filtra a linha.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000351","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*)::int from atendimento.mensagens where id = '35000000-0000-0000-0000-000000000002'),
  0,
  'sem modulo atendimento NAO ve a mensagem inserida'
);
reset role;

select * from finish();
rollback;
