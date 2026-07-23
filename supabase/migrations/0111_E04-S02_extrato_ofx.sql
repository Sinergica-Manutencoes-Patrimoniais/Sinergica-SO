-- 0111_E04-S02_extrato_ofx.sql
-- Import de extrato OFX: financeiro.extrato_transacoes (dedupe por conta+FITID) e
-- financeiro.regras_classificacao (sugestão por substring no memo). FK de conciliação em
-- lancamentos.extrato_transacao_id NOT VALID aqui; VALIDATE em 0112 (padrão split da casa).
-- Reverso:
--   select cron... (nenhum cron nesta story)
--   alter table financeiro.lancamentos drop constraint if exists lancamentos_extrato_transacao_id_fkey;
--   drop table if exists financeiro.regras_classificacao;
--   drop table if exists financeiro.extrato_transacoes;

create table financeiro.extrato_transacoes (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references financeiro.contas_bancarias (id),
  fitid text not null,
  data date not null,
  valor_centavos integer not null,
  memo text,
  tipo_ofx text,
  status text not null default 'pendente' check (status in ('pendente', 'conciliado', 'ignorado')),
  lancamento_id uuid references financeiro.lancamentos (id),
  importado_em timestamptz not null default now(),
  unique (conta_id, fitid)
);

create index idx_extrato_transacoes_status on financeiro.extrato_transacoes (status);
create index idx_extrato_transacoes_data on financeiro.extrato_transacoes (data desc);

create table financeiro.regras_classificacao (
  id uuid primary key default gen_random_uuid(),
  padrao text not null,
  categoria_id uuid references financeiro.categorias (id),
  cliente_id uuid references pcm.clientes (id),
  fornecedor_id uuid references financeiro.fornecedores (id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_by uuid references auth.users (id)
);

alter table financeiro.extrato_transacoes enable row level security;
alter table financeiro.extrato_transacoes force row level security;
grant select on financeiro.extrato_transacoes to authenticated;
grant insert, update, delete on financeiro.extrato_transacoes to authenticated;
grant select, insert, update, delete on financeiro.extrato_transacoes to service_role;

create policy "extrato_transacoes_select_financeiro" on financeiro.extrato_transacoes for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
create policy "extrato_transacoes_insert_financeiro" on financeiro.extrato_transacoes for insert to authenticated
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "extrato_transacoes_update_financeiro" on financeiro.extrato_transacoes for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "extrato_transacoes_delete_financeiro" on financeiro.extrato_transacoes for delete to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');

alter table financeiro.regras_classificacao enable row level security;
alter table financeiro.regras_classificacao force row level security;
grant select on financeiro.regras_classificacao to authenticated;
grant insert, update, delete on financeiro.regras_classificacao to authenticated;
grant select, insert, update, delete on financeiro.regras_classificacao to service_role;

create policy "regras_classificacao_select_financeiro" on financeiro.regras_classificacao for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
create policy "regras_classificacao_insert_financeiro" on financeiro.regras_classificacao for insert to authenticated
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "regras_classificacao_update_financeiro" on financeiro.regras_classificacao for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "regras_classificacao_delete_financeiro" on financeiro.regras_classificacao for delete to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');

-- Conciliação: lançamento <-> transação de extrato, 1:1. NOT VALID aqui; VALIDATE em 0112.
alter table financeiro.lancamentos
  add constraint lancamentos_extrato_transacao_id_fkey
  foreign key (extrato_transacao_id) references financeiro.extrato_transacoes (id) not valid;
