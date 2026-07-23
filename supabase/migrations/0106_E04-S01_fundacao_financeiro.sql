-- 0106_E04-S01_fundacao_financeiro.sql
-- Fundação do módulo Financeiro: categorias (plano de contas), contas bancárias, fornecedores,
-- lançamentos. RLS FORCE gateado por user_modulos.financeiro (padrão de 0079_E01-S54_despesas_auvo).
-- Reverso: drop function financeiro.fn_saldo_contas; drop table financeiro.lancamentos;
--   drop table financeiro.fornecedores; drop table financeiro.contas_bancarias;
--   drop table financeiro.categorias;

grant usage on schema financeiro to authenticated, service_role;

create table financeiro.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  parent_id uuid references financeiro.categorias (id),
  ativo boolean not null default true,
  seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_by uuid references auth.users (id)
);

create table financeiro.contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  banco text,
  saldo_inicial_centavos integer not null default 0,
  saldo_inicial_em date not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_by uuid references auth.users (id)
);

create table financeiro.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  contato text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_by uuid references auth.users (id)
);

create table financeiro.lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('entrada', 'saida')),
  status text not null default 'realizado' check (status in ('previsto', 'realizado')),
  valor_centavos integer not null check (valor_centavos > 0),
  data_competencia date not null,
  data_vencimento date,
  data_pagamento date,
  categoria_id uuid not null references financeiro.categorias (id),
  conta_id uuid references financeiro.contas_bancarias (id),
  cliente_id uuid references pcm.clientes (id),
  fornecedor_id uuid references financeiro.fornecedores (id),
  contrato_id uuid, -- FK adicionada na E04-S04 (not valid -> validate)
  os_id uuid references pcm.ordens_servico (id),
  origem text not null default 'manual' check (origem in ('manual', 'ofx', 'recorrencia')),
  extrato_transacao_id uuid, -- FK adicionada na E04-S02; preenchida = conciliado
  descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_by uuid references auth.users (id),
  constraint lancamentos_previsto_exige_vencimento
    check (status <> 'previsto' or data_vencimento is not null),
  constraint lancamentos_realizado_exige_pagamento
    check (status <> 'realizado' or data_pagamento is not null)
);

create index idx_lancamentos_competencia on financeiro.lancamentos (data_competencia desc);
create index idx_lancamentos_conta on financeiro.lancamentos (conta_id);
create index idx_lancamentos_cliente on financeiro.lancamentos (cliente_id);
create index idx_lancamentos_categoria on financeiro.lancamentos (categoria_id);
create index idx_lancamentos_status on financeiro.lancamentos (status);
create index idx_categorias_parent on financeiro.categorias (parent_id);

-- RLS FORCE — padrão do repo (ver 0079_E01-S54_despesas_auvo.sql)
alter table financeiro.categorias enable row level security;
alter table financeiro.categorias force row level security;
alter table financeiro.contas_bancarias enable row level security;
alter table financeiro.contas_bancarias force row level security;
alter table financeiro.fornecedores enable row level security;
alter table financeiro.fornecedores force row level security;
alter table financeiro.lancamentos enable row level security;
alter table financeiro.lancamentos force row level security;

grant select on financeiro.categorias, financeiro.contas_bancarias, financeiro.fornecedores, financeiro.lancamentos
  to authenticated;
grant insert, update, delete on financeiro.categorias, financeiro.contas_bancarias, financeiro.fornecedores, financeiro.lancamentos
  to authenticated; -- RLS restringe por policy abaixo
grant select, insert, update, delete on financeiro.categorias, financeiro.contas_bancarias, financeiro.fornecedores, financeiro.lancamentos
  to service_role;

create policy "categorias_select_financeiro" on financeiro.categorias for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
create policy "categorias_insert_financeiro" on financeiro.categorias for insert to authenticated
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "categorias_update_financeiro" on financeiro.categorias for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "categorias_delete_financeiro" on financeiro.categorias for delete to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');

create policy "contas_bancarias_select_financeiro" on financeiro.contas_bancarias for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
create policy "contas_bancarias_insert_financeiro" on financeiro.contas_bancarias for insert to authenticated
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "contas_bancarias_update_financeiro" on financeiro.contas_bancarias for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "contas_bancarias_delete_financeiro" on financeiro.contas_bancarias for delete to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');

create policy "fornecedores_select_financeiro" on financeiro.fornecedores for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
create policy "fornecedores_insert_financeiro" on financeiro.fornecedores for insert to authenticated
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "fornecedores_update_financeiro" on financeiro.fornecedores for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "fornecedores_delete_financeiro" on financeiro.fornecedores for delete to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');

create policy "lancamentos_select_financeiro" on financeiro.lancamentos for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
create policy "lancamentos_insert_financeiro" on financeiro.lancamentos for insert to authenticated
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "lancamentos_update_financeiro" on financeiro.lancamentos for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "lancamentos_delete_financeiro" on financeiro.lancamentos for delete to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');

-- AC-6: saldo de conta é sempre derivado (nunca coluna gravada). security invoker respeita a RLS
-- de quem chama (padrão D-3 do design.md).
create or replace function financeiro.fn_saldo_contas()
returns table (conta_id uuid, saldo_centavos bigint)
language sql
stable
security invoker
set search_path = financeiro, pg_temp
as $$
  select
    cb.id as conta_id,
    cb.saldo_inicial_centavos
      + coalesce(sum(
          case
            when l.status = 'realizado' and l.tipo = 'entrada' then l.valor_centavos
            when l.status = 'realizado' and l.tipo = 'saida' then -l.valor_centavos
            else 0
          end
        ), 0) as saldo_centavos
  from financeiro.contas_bancarias cb
  left join financeiro.lancamentos l
    on l.conta_id = cb.id
   and l.status = 'realizado'
   and l.data_pagamento >= cb.saldo_inicial_em
  group by cb.id, cb.saldo_inicial_centavos;
$$;

grant execute on function financeiro.fn_saldo_contas() to authenticated;

-- Seed do plano de contas (2 níveis) — editável/desativável em tela, seed=true só marca origem.
insert into financeiro.categorias (nome, tipo, seed) values
  ('Receita de contrato', 'entrada', true),
  ('Serviços avulsos', 'entrada', true),
  ('Laudos e inspeções', 'entrada', true),
  ('Outras receitas', 'entrada', true),
  ('Impostos e taxas', 'saida', true),
  ('Tarifas e juros bancários', 'saida', true);

-- Grupos de nível 1 (saída) que recebem subcategorias
with grupos as (
  insert into financeiro.categorias (nome, tipo, seed) values
    ('Pessoal', 'saida', true),
    ('Operação', 'saida', true),
    ('Veículos', 'saida', true),
    ('Administrativo', 'saida', true)
  returning id, nome
)
insert into financeiro.categorias (nome, tipo, parent_id, seed)
select sub.nome, 'saida', grupos.id, true
from grupos
join (values
  ('Pessoal', 'Salários'),
  ('Pessoal', 'Encargos'),
  ('Pessoal', 'Benefícios'),
  ('Pessoal', 'Pró-labore'),
  ('Operação', 'Combustível'),
  ('Operação', 'Peças e materiais'),
  ('Operação', 'EPI'),
  ('Operação', 'Ferramentas'),
  ('Operação', 'Terceiros'),
  ('Veículos', 'Manutenção'),
  ('Veículos', 'Seguro/IPVA'),
  ('Administrativo', 'Aluguel'),
  ('Administrativo', 'Contas de consumo'),
  ('Administrativo', 'Software e assinaturas'),
  ('Administrativo', 'Contabilidade')
) as sub(grupo_nome, nome) on sub.grupo_nome = grupos.nome;
