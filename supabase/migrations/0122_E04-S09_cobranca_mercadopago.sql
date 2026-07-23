-- 0122_E04-S09_cobranca_mercadopago.sql
-- Cobrança boleto/PIX via Mercado Pago (AC-1..AC-5). `financeiro.cobrancas` liga um recebível
-- (financeiro.lancamentos) a uma cobrança externa (id do pagamento MP + linha digitável/QR/link);
-- `financeiro.cobrancas_eventos` dedupe de webhook por id do evento (AC-3/AC-4, idempotência —
-- mesmo espírito do motor Auvo). Credencial (access token + webhook secret) vai pro Vault via
-- `config.fn_definir_segredo_integracao` (E00-S12, já genérica por chave — nenhuma RPC nova aqui);
-- este arquivo só semeia a linha de metadado em `config.integracoes` (chave='mercadopago').
-- Reverso:
--   select cron.unschedule('financeiro_cobranca_reconciliar_horaria');
--   drop function if exists financeiro.fn_cobranca_reconciliar_disparo();
--   delete from config.integracoes where chave = 'mercadopago';
--   drop table if exists financeiro.cobrancas_eventos;
--   drop table if exists financeiro.cobrancas;

create table financeiro.cobrancas (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references financeiro.lancamentos (id),
  tipo text not null check (tipo in ('boleto', 'pix')),
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado', 'estornado', 'expirado')),
  provedor text not null default 'mercadopago',
  external_id text not null unique,
  linha_digitavel text,
  qr_code text,
  qr_code_base64 text,
  link_pagamento text,
  valor_centavos integer not null check (valor_centavos > 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);

create index idx_cobrancas_lancamento on financeiro.cobrancas (lancamento_id);

alter table financeiro.cobrancas enable row level security;
alter table financeiro.cobrancas force row level security;
grant select on financeiro.cobrancas to authenticated;
grant select, insert, update, delete on financeiro.cobrancas to service_role;

create policy "cobrancas_select_financeiro" on financeiro.cobrancas for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
-- sem policy de insert/update pra `authenticated` — emissão/baixa sempre passam pela Edge Function
-- (service_role), nunca escrita direta do client (evita status de pagamento forjado pelo browser).

-- AC-3/AC-4: dedupe de evento de webhook/reconciliação — só o job (service_role) grava.
create table financeiro.cobrancas_eventos (
  id uuid primary key default gen_random_uuid(),
  cobranca_id uuid references financeiro.cobrancas (id) on delete set null,
  evento_externo_id text not null unique,
  origem text not null check (origem in ('webhook', 'reconciliacao')),
  status_recebido text not null,
  payload jsonb,
  processado_em timestamptz not null default now()
);

create index idx_cobrancas_eventos_cobranca on financeiro.cobrancas_eventos (cobranca_id);

alter table financeiro.cobrancas_eventos enable row level security;
alter table financeiro.cobrancas_eventos force row level security;
grant select on financeiro.cobrancas_eventos to authenticated;
grant select, insert, update, delete on financeiro.cobrancas_eventos to service_role;

create policy "cobrancas_eventos_select_financeiro" on financeiro.cobrancas_eventos for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));

-- AC-1: metadado do provedor (a credencial em si vai pro Vault via RPC já existente de E00-S12,
-- nunca aqui). Semeia inativo — superadmin liga em Configurações > Integrações depois de configurar
-- a credencial real.
insert into config.integracoes (chave, provedor, ativo, config_publico)
values ('mercadopago', 'mercadopago', false, '{"ambiente": "sandbox"}'::jsonb)
on conflict (chave) do nothing;

-- AC-4: reconciliação de hora em hora (webhook é o caminho principal, isto é a rede de segurança
-- pra notificação perdida) — mesmo padrão pg_net + secrets do Vault já reusado em 0013/0121.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

create or replace function financeiro.fn_cobranca_reconciliar_disparo()
returns void
language plpgsql
security definer
set search_path = financeiro, extensions, vault, public
as $$
declare
  v_project_url text;
  v_service_role_key text;
  v_headers jsonb;
  v_request_id bigint;
begin
  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'auvo_trigger_project_url' limit 1;
  select decrypted_secret into v_service_role_key
    from vault.decrypted_secrets where name = 'auvo_trigger_service_role_key' limit 1;

  if v_project_url is null or v_service_role_key is null then
    raise warning 'fn_cobranca_reconciliar_disparo: secrets do Vault ausentes — reconciliação pulada';
    return;
  end if;

  v_headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_role_key);

  select net.http_post(
    url := v_project_url || '/functions/v1/financeiro-cobranca-reconciliar',
    headers := v_headers,
    body := '{}'::jsonb
  ) into v_request_id;
exception
  when others then
    raise warning 'fn_cobranca_reconciliar_disparo: falha ao disparar pg_net — %', SQLERRM;
end;
$$;

select cron.schedule(
  'financeiro_cobranca_reconciliar_horaria',
  '0 * * * *',
  'select financeiro.fn_cobranca_reconciliar_disparo();'
);
