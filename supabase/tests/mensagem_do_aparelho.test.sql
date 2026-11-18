-- mensagem_do_aparelho.test.sql — pgTAP (E02-S39)
-- Matriz de decisão da spec: Ninguém é a chave de desligar, automática/atraso não tiram o Zé,
-- eco não duplica, caminho feliz pausa+atribui+cancela fila. Rodar com `supabase test db`.

begin;
select plan(9);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000391', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'resp-s39@test.local', crypt('x', gen_salt('bf')), now(),
  '{"user_role":"colaborador"}', '{}', now(), now()
) on conflict (id) do nothing;

insert into config.usuarios (user_id, papel, nome, ativo)
values ('00000000-0000-0000-0000-000000000391', 'colaborador', 'Atendente S39', true)
on conflict (user_id) do update set ativo = true;

insert into atendimento.canais_externos (id, tipo, label, identificador_externo, ativo)
values ('00000000-0000-0000-0000-000000000392', 'evolution', 'Canal S39', 'inst-s39', true)
on conflict (id) do nothing;

-- 1: SEM responsável configurado ("Ninguém") — mensagem entra, nada mais muda
select ok(
  (select not tirou_o_ze from atendimento.fn_registrar_mensagem_do_aparelho(
    '00000000-0000-0000-0000-000000000392', 'inst-s39', '5511911111111@s.whatsapp.net',
    'REMOTE-A1', 'oi, sem responsavel configurado', now()
  )),
  'sem responsável configurado, "Ninguém" é a chave de desligar — não tira o Zé'
);

-- Configura responsável + 1 texto automático
insert into atendimento.canal_aparelho (canal_id, responsavel_id, textos_automaticos, versao)
values (
  '00000000-0000-0000-0000-000000000392', '00000000-0000-0000-0000-000000000391',
  '["Esta é uma mensagem automática do WhatsApp Business"]'::jsonb, 1
)
on conflict (canal_id) do update set responsavel_id = excluded.responsavel_id,
  textos_automaticos = excluded.textos_automaticos;

-- 2: mensagem automática do WhatsApp Business não tira o Zé
select ok(
  (select not tirou_o_ze from atendimento.fn_registrar_mensagem_do_aparelho(
    '00000000-0000-0000-0000-000000000392', 'inst-s39', '5511922222222@s.whatsapp.net',
    'REMOTE-A2', '  esta É uma mensagem automática do whatsapp business  ', now()
  )),
  'texto automático (normalizado) não tira o Zé'
);

-- 3: mensagem atrasada (> 15 min) não tira o Zé
select ok(
  (select not tirou_o_ze from atendimento.fn_registrar_mensagem_do_aparelho(
    '00000000-0000-0000-0000-000000000392', 'inst-s39', '5511933333333@s.whatsapp.net',
    'REMOTE-A3', 'respondendo atrasado', now() - interval '20 minutes'
  )),
  'mensagem com mais de 15 min de atraso não tira o Zé'
);

-- 4: caminho feliz — tira o Zé, pausa e atribui
select ok(
  (select tirou_o_ze from atendimento.fn_registrar_mensagem_do_aparelho(
    '00000000-0000-0000-0000-000000000392', 'inst-s39', '5511944444444@s.whatsapp.net',
    'REMOTE-A4', 'pode deixar que eu assumo', now()
  )),
  'mensagem nova, a tempo, com responsável válido: tira o Zé'
);

select is(
  (select modo from atendimento.conversas where remote_jid = '5511944444444@s.whatsapp.net'),
  'pausado',
  'conversa pausada'
);

select is(
  (select atribuido_a from atendimento.conversas where remote_jid = '5511944444444@s.whatsapp.net'),
  '00000000-0000-0000-0000-000000000391'::uuid,
  'conversa atribuída à pessoa do aparelho'
);

-- 5: eco por id — mesma entrega duas vezes não duplica nem pausa de novo
select is(
  (select count(*)::int from atendimento.mensagens where wa_message_id = 'REMOTE-A4'),
  1,
  'uma só mensagem para REMOTE-A4 mesmo chamando a RPC de novo'
);
select ok(
  (select not tirou_o_ze from atendimento.fn_registrar_mensagem_do_aparelho(
    '00000000-0000-0000-0000-000000000392', 'inst-s39', '5511944444444@s.whatsapp.net',
    'REMOTE-A4', 'pode deixar que eu assumo', now()
  )),
  'reentrega do mesmo remote_id (eco) não tira o Zé de novo'
);

-- 6: pessoa inválida (desativada) é recusada na configuração
update config.usuarios set ativo = false where user_id = '00000000-0000-0000-0000-000000000391';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000391","user_role":"superadmin"}';
select throws_ok(
  $$ select atendimento.fn_salvar_configuracao_do_aparelho(
       '00000000-0000-0000-0000-000000000392'::uuid,
       '00000000-0000-0000-0000-000000000391'::uuid,
       '[]'::jsonb, 1) $$,
  '23514',
  null,
  'pessoa inativa é recusada como responsável do aparelho'
);

select * from finish();
rollback;
