-- 0113_E04-S05_recorrencias_projecao.sql
-- Despesas fixas recorrentes (financeiro.recorrencias) + extensão de fn_gerar_recorrencias (0108)
-- pra também materializar saídas + RPC fn_projecao_caixa (30/60/90). Design:
-- specs/E04-S01-fundacao-financeiro/design.md §S05/D-4.
-- Reverso:
--   drop function if exists financeiro.fn_projecao_caixa(int);
--   create or replace function financeiro.fn_gerar_recorrencias(date) ... (reverter só a parte de saída — ver 0108)
--   alter table financeiro.lancamentos drop constraint if exists lancamentos_recorrencia_id_fkey;
--   drop index if exists financeiro.lancamentos_recorrencia_competencia_uidx;
--   drop table if exists financeiro.recorrencias;

create table financeiro.recorrencias (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  tipo text not null default 'saida' check (tipo in ('saida')),
  valor_centavos integer not null check (valor_centavos > 0),
  dia_vencimento integer not null check (dia_vencimento between 1 and 28),
  categoria_id uuid not null references financeiro.categorias (id),
  fornecedor_id uuid references financeiro.fornecedores (id),
  conta_id uuid references financeiro.contas_bancarias (id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_by uuid references auth.users (id)
);

create index idx_recorrencias_ativo on financeiro.recorrencias (ativo);

alter table financeiro.recorrencias enable row level security;
alter table financeiro.recorrencias force row level security;
grant select on financeiro.recorrencias to authenticated;
grant insert, update, delete on financeiro.recorrencias to authenticated;
grant select, insert, update, delete on financeiro.recorrencias to service_role;

create policy "recorrencias_select_financeiro" on financeiro.recorrencias for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
create policy "recorrencias_insert_financeiro" on financeiro.recorrencias for insert to authenticated
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "recorrencias_update_financeiro" on financeiro.recorrencias for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
create policy "recorrencias_delete_financeiro" on financeiro.recorrencias for delete to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');

alter table financeiro.lancamentos add column recorrencia_id uuid;
alter table financeiro.lancamentos
  add constraint lancamentos_recorrencia_id_fkey
  foreign key (recorrencia_id) references financeiro.recorrencias (id) not valid;

create unique index lancamentos_recorrencia_competencia_uidx
  on financeiro.lancamentos (recorrencia_id, data_competencia)
  where origem = 'recorrencia' and recorrencia_id is not null;

-- Estende fn_gerar_recorrencias (0108): agora também materializa 1 saída prevista por
-- recorrência ativa vigente, além das entradas de contrato já existentes. Mesma idempotência
-- (unique parcial), mesmo raciocínio de security invoker.
create or replace function financeiro.fn_gerar_recorrencias(p_competencia date)
returns integer
language plpgsql
security invoker
set search_path = financeiro, pg_temp
as $$
declare
  v_competencia date := date_trunc('month', p_competencia)::date;
  v_fim_mes date := (date_trunc('month', p_competencia) + interval '1 month' - interval '1 day')::date;
  v_categoria_id uuid;
  v_criados integer := 0;
  v_linhas integer;
begin
  select id into v_categoria_id
  from financeiro.categorias
  where nome = 'Receita de contrato' and parent_id is null
  limit 1;

  insert into financeiro.lancamentos (
    tipo, status, valor_centavos, data_competencia, data_vencimento,
    categoria_id, cliente_id, contrato_id, origem
  )
  select
    'entrada', 'previsto', c.valor_mensal_centavos, v_competencia,
    v_competencia + (c.dia_vencimento - 1),
    v_categoria_id, c.cliente_id, c.id, 'recorrencia'
  from financeiro.contratos c
  where c.status = 'ativo'
    and c.inicio <= v_fim_mes
    and (c.fim is null or c.fim >= v_competencia)
  on conflict (contrato_id, data_competencia) where (origem = 'recorrencia') do nothing;

  get diagnostics v_linhas = row_count;
  v_criados := v_criados + v_linhas;

  insert into financeiro.lancamentos (
    tipo, status, valor_centavos, data_competencia, data_vencimento,
    categoria_id, conta_id, fornecedor_id, recorrencia_id, origem
  )
  select
    'saida', 'previsto', r.valor_centavos, v_competencia,
    v_competencia + (r.dia_vencimento - 1),
    r.categoria_id, r.conta_id, r.fornecedor_id, r.id, 'recorrencia'
  from financeiro.recorrencias r
  where r.ativo
  on conflict (recorrencia_id, data_competencia) where (origem = 'recorrencia' and recorrencia_id is not null) do nothing;

  get diagnostics v_linhas = row_count;
  v_criados := v_criados + v_linhas;

  return v_criados;
end;
$$;

comment on function financeiro.fn_gerar_recorrencias(date)
  is 'E04-S04/S05: gera 1 recebível previsto por contrato ativo + 1 pagável previsto por recorrência ativa, na competência. Idempotente (unique parcial por contrato/recorrência + competência).';

-- Projeção de caixa: posição atual (S03) + previstos com vencimento até o horizonte, agrupado por
-- semana (AC-3). security invoker: RLS de financeiro.* filtra por quem consulta.
create or replace function financeiro.fn_projecao_caixa(p_horizonte_dias int default 90)
returns table (
  dias_horizonte int,
  data_limite date,
  saldo_projetado_centavos bigint,
  entradas_previstas_centavos bigint,
  saidas_previstas_centavos bigint
)
language plpgsql
stable
security invoker
set search_path = financeiro, pg_temp
as $$
declare
  v_posicao_caixa bigint;
begin
  select coalesce(sum(
    cb.saldo_inicial_centavos
    + coalesce((
        select sum(case when l.tipo = 'entrada' then l.valor_centavos else -l.valor_centavos end)
        from financeiro.lancamentos l
        where l.conta_id = cb.id and l.status = 'realizado' and l.data_pagamento >= cb.saldo_inicial_em
      ), 0)
  ), 0)
  into v_posicao_caixa
  from financeiro.contas_bancarias cb
  where cb.ativo;

  return query
  select
    h.dias,
    (current_date + h.dias)::date as data_limite,
    v_posicao_caixa
      + coalesce((
          select sum(valor_centavos) from financeiro.lancamentos
          where tipo = 'entrada' and status = 'previsto'
            and data_vencimento between current_date and current_date + h.dias
        ), 0)
      - coalesce((
          select sum(valor_centavos) from financeiro.lancamentos
          where tipo = 'saida' and status = 'previsto'
            and data_vencimento between current_date and current_date + h.dias
        ), 0) as saldo_projetado_centavos,
    coalesce((
      select sum(valor_centavos) from financeiro.lancamentos
      where tipo = 'entrada' and status = 'previsto'
        and data_vencimento between current_date and current_date + h.dias
    ), 0) as entradas_previstas_centavos,
    coalesce((
      select sum(valor_centavos) from financeiro.lancamentos
      where tipo = 'saida' and status = 'previsto'
        and data_vencimento between current_date and current_date + h.dias
    ), 0) as saidas_previstas_centavos
  from unnest(array[7, 14, 21, 28, 30, 60, greatest(p_horizonte_dias, 90)]) as h(dias)
  order by h.dias;
end;
$$;

revoke all on function financeiro.fn_projecao_caixa(int) from public;
grant execute on function financeiro.fn_projecao_caixa(int) to authenticated;

comment on function financeiro.fn_projecao_caixa(int)
  is 'E04-S05: saldo projetado por janela (semanal até 30d + 60/90) = posição de caixa atual + previstos com vencimento na janela. Nunca conta lançamento realizado/conciliado duas vezes (só olha status=previsto).';

-- Contas a pagar — espelho de financeiro.aging_recebiveis (0108) pro lado da saída (AC-2, "mesmo
-- padrão de faixas do aging da S04"). GRANT explícito aqui — 0108 esqueceu e quebrou em produção
-- (view não herda grant da tabela base), corrigido em 0110; não repetir o erro.
create view financeiro.aging_pagaveis
with (security_invoker = on) as
select
  l.id as lancamento_id,
  l.fornecedor_id,
  l.categoria_id,
  l.conta_id,
  l.valor_centavos,
  l.data_vencimento,
  l.descricao,
  case
    when l.data_vencimento >= current_date then 'a_vencer'
    when current_date - l.data_vencimento between 1 and 3 then 'd1_3'
    when current_date - l.data_vencimento between 4 and 7 then 'd4_7'
    when current_date - l.data_vencimento between 8 and 15 then 'd8_15'
    else 'd15_mais'
  end as faixa,
  greatest(current_date - l.data_vencimento, 0) as dias_atraso
from financeiro.lancamentos l
where l.tipo = 'saida'
  and l.status = 'previsto'
  and l.data_vencimento is not null;

grant select on financeiro.aging_pagaveis to authenticated;
