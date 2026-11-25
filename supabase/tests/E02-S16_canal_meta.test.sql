-- E02-S16 / ADR-1700 — canal Meta por canal: credencial no cofre, segredo fora da tabela que
-- `authenticated` lê, e ingestão idempotente por (canal, evento, id remoto).
begin;
select plan(17);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('19160000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s16-meta-admin@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('19160000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s16-meta-colab@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('19160000-0000-4000-8000-000000000001','superadmin','Meta Admin',true),
 ('19160000-0000-4000-8000-000000000002','colaborador','Meta Colab',true);

insert into atendimento.canais_externos (id, tipo, label, identificador_externo)
values ('19160000-0000-4000-8000-00000000000a', 'instagram', 'Conta IG de teste', '17841400000000000');

-- ── provedor derivado do tipo (antes caía em 'desconhecido') ──────────────────
select is(
  (select provedor from atendimento.canais_externos where id = '19160000-0000-4000-8000-00000000000a'),
  'meta-instagram',
  'canal instagram nasce com provedor meta-instagram, não desconhecido'
);

-- ── segredo não mora mais em canais_externos ─────────────────────────────────
select throws_ok(
  $$update atendimento.canais_externos set verify_token = 'segredo-em-claro'
     where id = '19160000-0000-4000-8000-00000000000a'$$,
  '23514',
  null,
  'verify_token não aceita valor: segredo não fica em tabela que authenticated lê'
);

-- ── RLS/grants de meta_canal: só service_role ────────────────────────────────
select is(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'atendimento.meta_canal'::regclass),
  true,
  'meta_canal tem RLS enable + force'
);
select is(
  has_table_privilege('authenticated', 'atendimento.meta_canal', 'SELECT'),
  false,
  'authenticated NÃO lê meta_canal — nem a referência do cofre vaza para o browser'
);
select is(
  has_table_privilege('anon', 'atendimento.meta_canal', 'SELECT'),
  false,
  'anon NÃO lê meta_canal'
);
select is(
  has_table_privilege('service_role', 'atendimento.meta_canal', 'INSERT'),
  true,
  'service_role escreve meta_canal — é quem a Edge Function usa'
);
select is(
  has_function_privilege('authenticated', 'atendimento.fn_registrar_mensagem_meta(uuid,text,text,text,text,text,text,text)', 'EXECUTE'),
  false,
  'authenticated não executa a ingestão: só o webhook autenticado por canal escreve'
);

insert into atendimento.meta_canal (canal_id, conta_externa_id, app_secret_ref, token_ref, verify_token_ref)
values (
  '19160000-0000-4000-8000-00000000000a',
  '17841400000000000',
  'SINERGICA_METASECRET_1_191600000000400080000000000000aa',
  'SINERGICA_METATOKEN_1_191600000000400080000000000000aa',
  'SINERGICA_METAVERIFY_1_191600000000400080000000000000aa'
);
select is(
  (select estado from atendimento.meta_canal where canal_id = '19160000-0000-4000-8000-00000000000a'),
  'sem_credencial',
  'meta_canal nasce sem_credencial: gravar referência não é o mesmo que estar conectado'
);
select throws_ok(
  $$insert into atendimento.meta_canal (canal_id, conta_externa_id)
    values ('19160000-0000-4000-8000-00000000000a', 'conta-que-nao-e-numero')$$,
  '23514',
  null,
  'conta externa que não é numérica é recusada — id da Meta é só dígito'
);

-- ── ingestão: idempotência (canal, evento, id) e canal/provedor corretos ─────
select is(
  (select duplicado from atendimento.fn_registrar_mensagem_meta(
     '19160000-0000-4000-8000-00000000000a', 'instagram.messaging', 'mid-1',
     '17841400000000000', '123456789', null, 'oi, quanto custa?', 'instagram')),
  false,
  'primeira entrega grava a mensagem'
);
select is(
  (select duplicado from atendimento.fn_registrar_mensagem_meta(
     '19160000-0000-4000-8000-00000000000a', 'instagram.messaging', 'mid-1',
     '17841400000000000', '123456789', null, 'oi, quanto custa?', 'instagram')),
  true,
  'reentrega da Meta com o MESMO mid responde duplicado, sem segunda bolha'
);
select is(
  (select count(*)::int from atendimento.mensagens where wa_message_id = 'mid-1'),
  1,
  'uma só mensagem gravada para duas entregas do mesmo evento'
);
select is(
  (select canal || '/' || provedor from atendimento.conversas where remote_jid = '123456789'),
  'instagram/meta',
  'a conversa nasce identificada como Instagram pela Meta — o Inbox mostra o canal certo'
);
select is(
  (select canal_id from atendimento.conversas where remote_jid = '123456789'),
  '19160000-0000-4000-8000-00000000000a'::uuid,
  'conversa aponta para o canal resolvido pela ROTA do webhook, nunca pelo corpo do evento'
);

-- ── eco (is_echo): resposta dada pelo app, no canal CERTO ───────────────────
select is(
  (select duplicado from atendimento.fn_registrar_eco_meta(
     '19160000-0000-4000-8000-00000000000a', 'instagram.echo', 'mid-eco-1',
     '17841400000000000', '987654321', 'respondi pelo app', now(), 'instagram')),
  false,
  'eco da conta grava mensagem de saída'
);
select is(
  (select canal || '/' || provedor from atendimento.conversas where remote_jid = '987654321'),
  'instagram/meta',
  'eco que chega ANTES da primeira mensagem do contato não carimba a conversa como WhatsApp'
);

select throws_ok(
  $$select atendimento.fn_registrar_mensagem_meta(
      '19160000-0000-4000-8000-00000000000a', 'instagram.messaging', 'mid-2',
      '17841400000000000', '123456789', null, 'oi', 'telegram')$$,
  '22023','canal_invalido',
  'canal fora da lista é recusado — ingestão não inventa canal novo'
);

select * from finish();
rollback;
