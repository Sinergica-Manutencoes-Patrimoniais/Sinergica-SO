-- config_ia_titulo_os_rls.test.sql — pgTAP (E01-S81 AC-1/AC-4)
-- `fn_integracao_ativa_publica` é a única RPC nova da story: booleano público (qualquer
-- authenticated, sem exigir superadmin) que nunca expõe segredo — usada pelo botão "Gerar título"
-- pra saber se degrada sem precisar de uma tentativa falha primeiro.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-comum-s81@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000601","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';

-- 1) usuário comum (sem superadmin) NAO consegue ler config.integracoes direto (RLS existente,
-- E00-S12) — prova que a RPC nova é mesmo necessária, não redundante.
select is(
  (select count(*)::int from config.integracoes where chave = 'openrouter'),
  0,
  'usuario comum NAO le config.integracoes direto (RLS superadmin-only de E00-S12)'
);

-- 2) mas a RPC pública funciona pra qualquer authenticated — semeada como ativo=false (0126)
select is(
  (select config.fn_integracao_ativa_publica('openrouter')),
  false,
  'usuario comum consegue chamar fn_integracao_ativa_publica — semeada inativa'
);

-- 3) chave inexistente devolve false (nunca erro)
select is(
  (select config.fn_integracao_ativa_publica('chave-que-nao-existe')),
  false,
  'chave inexistente devolve false, nunca erro'
);

-- 4) depois de ativar (via superadmin, fora de escopo simular aqui — só valida via update direto
-- como setup), a RPC pública reflete o novo estado.
reset role;
update config.integracoes set ativo = true where chave = 'openrouter';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000601","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select is(
  (select config.fn_integracao_ativa_publica('openrouter')),
  true,
  'depois de ativado, a RPC publica reflete true'
);

reset role;
select * from finish();
rollback;
