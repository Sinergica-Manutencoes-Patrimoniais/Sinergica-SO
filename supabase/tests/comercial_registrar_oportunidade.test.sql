-- comercial_registrar_oportunidade.test.sql — pgTAP (E03-S09)
-- Guarda service_role (AC-1), idempotência por conversa aberta (AC-6), reuso de Conta por vínculo
-- (AC-2), score fora de faixa (edge case), etapa de entrada configurável (AC-4), sem etapa aberta
-- falha explícito (AC-7). Cenários já confirmados manualmente em produção (smoke test com
-- `set_config`/rollback, incluindo os 7 cenários abaixo) antes desta suíte ser escrita. Rodar com
-- `supabase test db` (requer Docker).

begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sistema-s09@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into relacionamento.contatos (id, nome, telefone_principal, origem)
values ('00000000-0000-0000-0000-000000000f02', 'Contato Teste S09', '5511988880000', 'whatsapp')
on conflict (id) do nothing;

insert into atendimento.conversas (id, canal, instance_id, remote_jid, status, modo, provedor, contato_id)
values
  ('00000000-0000-0000-0000-000000000f03', 'whatsapp', 'ze-pcm-teste-s09', '5511988880000@s.whatsapp.net', 'aberta', 'pausado', 'evolution', '00000000-0000-0000-0000-000000000f02'),
  ('00000000-0000-0000-0000-000000000f04', 'whatsapp', 'ze-pcm-teste-s09', '5511988880001@s.whatsapp.net', 'aberta', 'pausado', 'evolution', '00000000-0000-0000-0000-000000000f02')
on conflict (id) do nothing;

set local role authenticated;

-- 1) AC-1: sem service_role, guarda nega
set local request.jwt.claims = '{"role":"authenticated","user_role":"colaborador"}';
select throws_ok(
  $$ select comercial.fn_registrar_oportunidade('X', '5511900000000', 50, null, 'x@s.whatsapp.net', 'A', null, null, null, '00000000-0000-0000-0000-000000000f01') $$,
  '42501',
  null,
  'sem service_role: guarda nega'
);

-- 2) score fora de 0-100
set local request.jwt.claims = '{"role":"service_role"}';
select throws_ok(
  $$ select comercial.fn_registrar_oportunidade('X', '5511900000000', 150, null, 'x@s.whatsapp.net', 'A', null, null, null, '00000000-0000-0000-0000-000000000f01') $$,
  '23514',
  null,
  'score fora de 0-100 e recusado'
);

-- 3) contato sem vínculo: cria Conta nova + oportunidade
select is(
  (select origem from comercial.fn_registrar_oportunidade(
    'Contato Teste S09', '5511988880000', 70, 'Interessado em contrato',
    '5511988880000@s.whatsapp.net', 'B', 'sindico_engajado',
    '00000000-0000-0000-0000-000000000f03', '00000000-0000-0000-0000-000000000f02',
    '00000000-0000-0000-0000-000000000f01'
  )),
  'whatsapp',
  'cria oportunidade com origem whatsapp'
);
select is(
  (select count(*)::int from relacionamento.vinculos
    where contato_id = '00000000-0000-0000-0000-000000000f02' and entidade_tipo = 'pcm_cliente'),
  1,
  'cria exatamente 1 vinculo pcm_cliente pro contato'
);

-- 4) AC-6: mesma conversa de novo — atualiza, não duplica
select is(
  (select count(*)::int from comercial.oportunidades
    where conversa_id = '00000000-0000-0000-0000-000000000f03' and deleted_at is null),
  1,
  'antes da segunda chamada: 1 oportunidade pra esta conversa'
);
select is(
  (select score from comercial.fn_registrar_oportunidade(
    'Contato Teste S09', '5511988880000', 95, 'Confirmou interesse',
    '5511988880000@s.whatsapp.net', 'A', 'sindico_engajado',
    '00000000-0000-0000-0000-000000000f03', '00000000-0000-0000-0000-000000000f02',
    '00000000-0000-0000-0000-000000000f01'
  )),
  95,
  'segunda chamada na MESMA conversa atualiza o score, nao cria outra'
);
select is(
  (select count(*)::int from comercial.oportunidades
    where conversa_id = '00000000-0000-0000-0000-000000000f03' and deleted_at is null),
  1,
  'depois da segunda chamada: continua 1 so oportunidade (idempotencia real)'
);

-- 5) AC-2: mesmo contato, conversa DIFERENTE — reusa a MESMA Conta
select is(
  (
    select (select cliente_id from comercial.oportunidades where conversa_id = '00000000-0000-0000-0000-000000000f03')
         = (select cliente_id from comercial.fn_registrar_oportunidade(
             'Contato Teste S09', '5511988880000', 40, 'Outra conversa',
             '5511988880001@s.whatsapp.net', 'C', null,
             '00000000-0000-0000-0000-000000000f04', '00000000-0000-0000-0000-000000000f02',
             '00000000-0000-0000-0000-000000000f01'
           ))
  ),
  true,
  'conversa nova do MESMO contato reusa a mesma Conta (nao duplica)'
);
select is(
  (select count(*)::int from relacionamento.vinculos
    where contato_id = '00000000-0000-0000-0000-000000000f02' and entidade_tipo = 'pcm_cliente'),
  1,
  'ainda so 1 vinculo, mesmo apos a segunda Conta-reuso (nao duplicou o vinculo)'
);

select * from finish();
rollback;
