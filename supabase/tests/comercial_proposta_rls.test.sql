-- comercial_proposta_rls.test.sql — pgTAP (E03-S04)
-- RLS de propostas/proposta_itens/proposta_versoes, append-only de versões (mesmo pra
-- superadmin), trigger de piso (AC-4) e trigger de transição de status (AC-6).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prop-sem-modulo-s04@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prop-leitura-s04@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prop-escrita-s04@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000604', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prop-superadmin-s04@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, ativo)
values ('00000000-0000-0000-0000-0000000006c1', 'Condomínio Teste E03-S04', true)
on conflict (id) do nothing;

insert into comercial.etapas_funil (id, nome, ordem, cor, tipo)
values ('00000000-0000-0000-0000-0000000006e1', 'Etapa Teste S04', 999, '#000000', 'aberta')
on conflict (id) do nothing;

set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000603","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';
insert into comercial.oportunidades (id, cliente_id, etapa_id, titulo)
values ('00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-0000000006e1', 'Oportunidade teste S04');

insert into comercial.propostas (id, oportunidade_id, tipo, custo_total_centavos, piso_centavos, preco_sugerido_centavos, preco_centavos)
values ('00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006a1', 'simples', 10000, 10638, 12766, 12766);

-- 1) sem `comercial`: RLS FORCE nega, sem erro
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000601","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*)::int from comercial.propostas where id = '00000000-0000-0000-0000-0000000006b1'),
  0,
  'sem modulo comercial: select de propostas retorna zero linhas'
);

-- 2) leitura: enxerga, mas não escreve
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000602","user_role":"colaborador","user_modulos":{"comercial":"leitura"}}';
select is(
  (select count(*)::int from comercial.propostas where id = '00000000-0000-0000-0000-0000000006b1'),
  1,
  'leitura comercial: select enxerga a proposta'
);
select throws_ok(
  $$ update comercial.propostas set status = 'em_revisao'
     where id = '00000000-0000-0000-0000-0000000006b1' $$,
  '42501',
  null,
  'leitura comercial NAO atualiza proposta'
);

-- 3) AC-4: preço abaixo do piso é recusado NO BANCO, mesmo por quem tem escrita
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000603","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';
select throws_ok(
  $$ update comercial.propostas set preco_centavos = 5000
     where id = '00000000-0000-0000-0000-0000000006b1' $$,
  '23514',
  null,
  'preco abaixo do piso e recusado pelo trigger, mesmo com comercial:escrita'
);

-- 4) AC-6: transição de status inválida recusada; válida aceita
select throws_ok(
  $$ update comercial.propostas set status = 'aceita'
     where id = '00000000-0000-0000-0000-0000000006b1' $$,
  '23514',
  null,
  'transicao rascunho -> aceita e recusada pelo trigger'
);
update comercial.propostas set status = 'em_revisao' where id = '00000000-0000-0000-0000-0000000006b1';
select is(
  (select status from comercial.propostas where id = '00000000-0000-0000-0000-0000000006b1'),
  'em_revisao',
  'transicao rascunho -> em_revisao aceita pelo trigger'
);

-- 5) itens: escrita cria, leitura não
insert into comercial.proposta_itens (proposta_id, tipo, descricao, quantidade, custo_unitario_centavos, total_centavos)
values ('00000000-0000-0000-0000-0000000006b1', 'mo', 'Item teste', 8, 2000, 16000);
select is(
  (select count(*)::int from comercial.proposta_itens where proposta_id = '00000000-0000-0000-0000-0000000006b1'),
  1,
  'escrita comercial: insere item da proposta'
);

-- 6) versões: append-only real — nem quem tem escrita normal, nem superadmin, atualiza/apaga
insert into comercial.proposta_versoes (proposta_id, versao, payload)
values ('00000000-0000-0000-0000-0000000006b1', 1, '{"teste":true}'::jsonb);
select is(
  (select count(*)::int from comercial.proposta_versoes where proposta_id = '00000000-0000-0000-0000-0000000006b1'),
  1,
  'escrita comercial: insere versao (snapshot)'
);
select throws_ok(
  $$ update comercial.proposta_versoes set payload = '{}'::jsonb
     where proposta_id = '00000000-0000-0000-0000-0000000006b1' $$,
  '42501',
  null,
  'proposta_versoes NAO aceita update mesmo com comercial:escrita'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000604","user_role":"superadmin","user_modulos":{}}';
select throws_ok(
  $$ delete from comercial.proposta_versoes
     where proposta_id = '00000000-0000-0000-0000-0000000006b1' $$,
  '42501',
  null,
  'proposta_versoes NAO aceita delete nem de superadmin (append-only real)'
);

-- 7) RPCs: fn_criar_proposta e fn_salvar_composicao_proposta ponta a ponta
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000603","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';
select is(
  (select status from comercial.fn_criar_proposta('00000000-0000-0000-0000-0000000006a1', 'volante')),
  'rascunho',
  'fn_criar_proposta cria em rascunho'
);
select is(
  (select count(*)::int from comercial.proposta_versoes v
     join comercial.propostas p on p.id = v.proposta_id
    where p.oportunidade_id = '00000000-0000-0000-0000-0000000006a1' and v.versao = 1) >= 2,
  true,
  'fn_criar_proposta grava o snapshot da versao 1 (ao menos 2 propostas criadas nesta oportunidade)'
);

-- 8) fn_salvar_composicao_proposta bloqueia preco abaixo do piso mesmo dentro da RPC
select throws_ok(
  $$ select comercial.fn_salvar_composicao_proposta(
       '00000000-0000-0000-0000-0000000006b1', '[]'::jsonb, 10000, 10638, 12766, 5000, null, null, null
     ) $$,
  '23514',
  null,
  'fn_salvar_composicao_proposta recusa preco abaixo do piso'
);

-- 9) fn_forcar_preco_abaixo_piso: só superadmin
select throws_ok(
  $$ select comercial.fn_forcar_preco_abaixo_piso('00000000-0000-0000-0000-0000000006b1', 5000, 'teste') $$,
  '42501',
  null,
  'fn_forcar_preco_abaixo_piso nega para quem nao e superadmin'
);

select * from finish();
rollback;
