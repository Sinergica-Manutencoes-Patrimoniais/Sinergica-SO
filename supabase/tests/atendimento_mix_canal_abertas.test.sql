-- atendimento_mix_canal_abertas.test.sql — pgTAP E01-S188 (defeito D do caderno).
-- Dados 100% fictícios. Mix de canal deve somar o mesmo que o KPI `abertas`.
begin;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000001881', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-mix-s188@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- Fictícias: 2 abertas antigas (whatsapp, instagram) + 1 aberta de hoje (whatsapp) + 1 encerrada (messenger)
insert into atendimento.conversas (id, instance_id, remote_jid, canal, status, created_at) values
  ('18800000-0000-0000-0000-000000000001', 'inst-s188', 'fict-1@test', 'whatsapp',  'aberta',    now() - interval '20 days'),
  ('18800000-0000-0000-0000-000000000002', 'inst-s188', 'fict-2@test', 'instagram', 'aberta',    now() - interval '20 days'),
  ('18800000-0000-0000-0000-000000000003', 'inst-s188', 'fict-3@test', 'whatsapp',  'aberta',    now()),
  ('18800000-0000-0000-0000-000000000004', 'inst-s188', 'fict-4@test', 'messenger', 'encerrada', now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000001881","user_role":"admin","user_modulos":{"atendimento":"leitura"}}';

create temp table snap as select atendimento.fn_metrics_snapshot('hoje') as j;
grant select on snap to authenticated;

select is(
  (select coalesce(sum((e->>'total')::int), 0)::int from snap, jsonb_array_elements(j->'mixCanal') e),
  (select (j->>'abertas')::int from snap),
  'soma do Mix de canal == KPI abertas (janela hoje)'
);
select is(
  (select (e->>'total')::int from snap, jsonb_array_elements(j->'mixCanal') e where e->>'canal' = 'whatsapp'),
  2,
  'whatsapp = 2 abertas (inclui a criada antes da janela)'
);
select is(
  (select (e->>'total')::int from snap, jsonb_array_elements(j->'mixCanal') e where e->>'canal' = 'instagram'),
  1,
  'instagram = 1 aberta antiga'
);
select is(
  (select count(*)::int from snap, jsonb_array_elements(j->'mixCanal') e where e->>'canal' = 'messenger'),
  0,
  'conversa encerrada nao entra no Mix'
);
select * from finish();
rollback;
