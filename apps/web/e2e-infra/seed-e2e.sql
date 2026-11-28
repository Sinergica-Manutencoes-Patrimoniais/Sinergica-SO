-- E00-S31 (SEC-006): seed FICTÍCIO da suíte E2E, aplicado só no Supabase local por
-- `rodar-e2e-local.sh`. Nenhum dado real. Idempotente (pode rodar a cada execução).
-- Não é migration nem `db.seed` do config.toml: não entra no pgTAP do CI nem em produção.

do $$
begin
  if coalesce(current_setting('app.e2e_permitir_seed', true), '') <> 'sim' then
    raise exception 'seed-e2e.sql só roda via rodar-e2e-local.sh (app.e2e_permitir_seed=sim)';
  end if;
end $$;

-- Usuário superadmin fictício (domínio .invalid). Senha só vale no banco local.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values (
  'e2e00000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'e2e-superadmin@sinergica.invalid',
  extensions.crypt('e2e-local-somente', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"nome":"Superadmin E2E"}', now(), now(),
  '', '', '', '', '', '', '', ''
) on conflict (id) do update
  set encrypted_password = excluded.encrypted_password, email_confirmed_at = now();

insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
values (
  'e2e00000-0000-4000-8000-000000000001', 'e2e00000-0000-4000-8000-000000000001',
  'e2e00000-0000-4000-8000-000000000001', 'email',
  '{"sub":"e2e00000-0000-4000-8000-000000000001","email":"e2e-superadmin@sinergica.invalid","email_verified":true}',
  now(), now(), now()
) on conflict do nothing;

insert into config.usuarios (user_id, papel, nome, ativo)
values ('e2e00000-0000-4000-8000-000000000001', 'superadmin', 'Superadmin E2E', true)
on conflict (user_id) do update set papel = 'superadmin', ativo = true;
