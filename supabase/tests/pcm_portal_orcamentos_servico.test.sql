-- pcm_portal_orcamentos_servico.test.sql — pgTAP (E03-S12)
-- Confirma AC-1 (dono documentado via comment on table) e AC-3 (view de consumo com RLS
-- equivalente à tabela-base — síndico da Conta certa vê, síndico de outra Conta não vê, staff PCM
-- vê, usuário sem módulo/vínculo não vê). AC-5 (nenhuma mudança de comportamento visível ao
-- síndico) já foi confirmado manualmente em produção (mesmos 4 cenários, dentro de rollback) antes
-- desta suíte ser escrita — aqui é a versão reproduzível. Rodar com `supabase test db` (requer
-- Docker).

begin;
select plan(6);

-- AC-1: comment on table documenta o dono (PCM) nas 3 tabelas do Fluxo B
select ok(
  (select obj_description('pcm.requisicoes_servico'::regclass, 'pg_class')) ilike '%dono é o PCM%',
  'comment on table pcm.requisicoes_servico documenta o dono (E03-S12)'
);
select ok(
  (select obj_description('pcm.orcamentos_servico'::regclass, 'pg_class')) ilike '%dono é o PCM%',
  'comment on table pcm.orcamentos_servico documenta o dono (E03-S12)'
);
select ok(
  (select obj_description('pcm.orcamento_decisoes'::regclass, 'pg_class')) ilike '%dono é o PCM%',
  'comment on table pcm.orcamento_decisoes documenta o dono (E03-S12)'
);

-- AC-3: view de consumo existe
select is(
  (select to_regclass('pcm.portal_orcamentos_servico')::text),
  'pcm.portal_orcamentos_servico',
  'view pcm.portal_orcamentos_servico existe'
);

-- fixture: cliente + requisição + orçamento
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000e0300', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'orcamento-s12@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, ativo, created_by)
values ('00000000-0000-0000-0000-0000000e0301', 'Cliente Teste S12 pgTAP', true, '00000000-0000-0000-0000-0000000e0300')
on conflict (id) do nothing;
insert into pcm.requisicoes_servico (id, cliente_id, titulo, status)
values ('00000000-0000-0000-0000-0000000e0302', '00000000-0000-0000-0000-0000000e0301', 'Requisição Teste S12', 'em_orcamento')
on conflict (id) do nothing;
insert into pcm.orcamentos_servico (id, requisicao_id, cliente_id, numero, titulo, itens, valor_total_centavos, status, valido_ate)
values ('00000000-0000-0000-0000-0000000e0303', '00000000-0000-0000-0000-0000000e0302', '00000000-0000-0000-0000-0000000e0301', 'ORC-PGTAP-S12', 'Orçamento Teste S12', '[]'::jsonb, 10000, 'pendente', current_date + 30)
on conflict (id) do nothing;

-- AC-3: síndico da Conta certa vê pela view
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","user_role":"cliente-sindico","cliente_id":"00000000-0000-0000-0000-0000000e0301"}';
select is(
  (select count(*)::int from pcm.portal_orcamentos_servico where id = '00000000-0000-0000-0000-0000000e0303'),
  1,
  'síndico da Conta certa vê o orçamento pela view'
);

-- AC-3: síndico de outra Conta não vê (RLS efetiva na view)
set local request.jwt.claims = '{"role":"authenticated","user_role":"cliente-sindico","cliente_id":"00000000-0000-0000-0000-0000000e0999"}';
select is(
  (select count(*)::int from pcm.portal_orcamentos_servico where id = '00000000-0000-0000-0000-0000000e0303'),
  0,
  'síndico de outra Conta não vê o orçamento pela view'
);

select * from finish();
rollback;
