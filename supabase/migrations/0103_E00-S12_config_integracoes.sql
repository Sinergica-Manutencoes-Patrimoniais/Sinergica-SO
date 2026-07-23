-- 0103_E00-S12_config_integracoes.sql — Sinérgica SO
-- Configurações > Integrações — cadastro de credenciais externas (começando por provedor de
-- e-mail, usado pelo laudo PMOC em E01-S05). A credencial em si NUNCA fica em tabela Postgres —
-- vai pro Supabase Vault via RPC `security definer`, mesmo padrão já usado pros secrets de cron
-- Auvo (ver comentários de `vault.create_secret` em 0011/0013/0015). A tabela guarda só metadado
-- não-sensível (provedor, e-mail remetente, se está ativo).
--
-- Reverso:
--   drop function if exists config.fn_integracao_tem_segredo(text);
--   drop function if exists config.fn_definir_segredo_integracao(text, text);
--   drop table if exists config.integracoes;

create table if not exists config.integracoes (
  id               uuid        primary key default gen_random_uuid(),
  chave            text        not null unique,     -- 'email' (extensível: 'whatsapp', 'sms'…)
  provedor         text,                             -- 'resend' etc — livre, sem enum (poucas opções por ora)
  ativo            boolean     not null default false,
  config_publico   jsonb       not null default '{}', -- ex.: {"fromEmail":"...","fromName":"..."} — nunca segredo
  configurado_em   timestamptz,
  configurado_por  uuid        references auth.users,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);

alter table config.integracoes enable row level security;
alter table config.integracoes force row level security;

grant usage on schema config to authenticated, service_role;
grant select, insert, update on config.integracoes to authenticated;
grant select, insert, update, delete on config.integracoes to service_role;

-- Só superadmin — credencial de integração é mais sensível que grupos/usuários (config.grupos
-- permite supervisor; aqui não).
create policy "integracoes_select" on config.integracoes
  for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin');

create policy "integracoes_insert" on config.integracoes
  for insert to authenticated
  with check (auth.jwt() ->> 'user_role' = 'superadmin');

create policy "integracoes_update" on config.integracoes
  for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin')
  with check (auth.jwt() ->> 'user_role' = 'superadmin');

-- AC-1/AC-4: grava/atualiza o segredo no Vault. `security definer` + checagem interna de
-- `user_role` (defesa em profundidade — não depende só da GRANT/RLS de quem pode chamar a função).
create or replace function config.fn_definir_segredo_integracao(p_chave text, p_valor text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  if (auth.jwt() ->> 'user_role') is distinct from 'superadmin' then
    raise exception 'Apenas superadmin pode configurar segredos de integração' using errcode = '42501';
  end if;
  if p_chave is null or btrim(p_chave) = '' then
    raise exception 'Chave da integração é obrigatória';
  end if;
  if p_valor is null or btrim(p_valor) = '' then
    raise exception 'Valor do segredo é obrigatório';
  end if;

  select id into v_secret_id from vault.secrets where name = p_chave;
  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_valor);
  else
    perform vault.create_secret(p_valor, p_chave);
  end if;
end;
$$;

revoke all on function config.fn_definir_segredo_integracao(text, text) from public, anon;
grant execute on function config.fn_definir_segredo_integracao(text, text) to authenticated;

-- AC-3/AC-4: só existência — nunca decripta/expõe o valor pra checagem de status na UI.
create or replace function config.fn_integracao_tem_segredo(p_chave text)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  if (auth.jwt() ->> 'user_role') is distinct from 'superadmin' then
    raise exception 'Apenas superadmin pode consultar integrações' using errcode = '42501';
  end if;
  return exists (select 1 from vault.secrets where name = p_chave);
end;
$$;

revoke all on function config.fn_integracao_tem_segredo(text) from public, anon;
grant execute on function config.fn_integracao_tem_segredo(text) to authenticated;
