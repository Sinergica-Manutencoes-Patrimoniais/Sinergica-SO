-- agente_comercial_leads.test.sql — pgTAP (E02-S08)
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(3);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000381', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-comercial-escrita@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- 'agente' é aceito no CHECK de remetente_tipo (mensagem do agente comercial no Inbox)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000381","user_role":"colaborador","user_modulos":{"atendimento":"escrita"}}';
select lives_ok(
  $$ insert into atendimento.conversas (id, instance_id, remote_jid, created_by) values ('38000000-0000-0000-0000-000000000001', 'inst-comercial', 'jid-lead@s.whatsapp.net', '00000000-0000-0000-0000-000000000381') $$,
  'cria conversa de teste pro lead'
);
select lives_ok(
  $$ insert into atendimento.mensagens (conversa_id, direcao, remetente_tipo, conteudo) values ('38000000-0000-0000-0000-000000000001', 'saida', 'agente', 'Olá! Vou te ajudar.') $$,
  'remetente_tipo agente e aceito pelo CHECK'
);
reset role;

-- service_role grava lead com score/resumo/conversa_id/origem_ref (colunas novas desta migration)
set local role service_role;
select lives_ok(
  $$ insert into comercial.leads (nome, origem, status, score, resumo, conversa_id, origem_ref, created_by) values ('Contato Teste', 'whatsapp', 'qualificado', 80, 'Precisa de manutenção elétrica, orçamento definido.', '38000000-0000-0000-0000-000000000001', 'jid-lead@s.whatsapp.net', '00000000-0000-0000-0000-000000000381') $$,
  'service_role cria lead com score/resumo/conversa_id/origem_ref'
);
reset role;

select * from finish();
rollback;
