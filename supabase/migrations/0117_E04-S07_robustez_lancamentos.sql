-- 0117_E04-S07_robustez_lancamentos.sql
-- Robustez operacional: comprovante anexado (bucket + coluna), eventos de auditoria append-only
-- (estorno/correção) e transferência entre contas (par de lançamentos vinculados, origem nova
-- 'transferencia' excluída das somas de entradas/saídas do dashboard — não é resultado, é
-- movimentação interna). AC-4 (estorno de baixa) já existe desde E04-S01
-- (baixarLancamento/estornarBaixaLancamento) — nada novo aqui.
-- Reverso:
--   create or replace function financeiro.fn_resumo_caixa() ... (reverter pra versão de 0107/sem filtro de origem)
--   create or replace function financeiro.fn_fluxo_mensal(int) ... (idem)
--   drop function if exists financeiro.fn_criar_transferencia(uuid, uuid, integer, date, text);
--   drop table if exists financeiro.transferencias;
--   alter table financeiro.lancamentos drop constraint if exists lancamentos_origem_check;
--   alter table financeiro.lancamentos add constraint lancamentos_origem_check check (origem in ('manual','ofx','recorrencia'));
--   drop table if exists financeiro.lancamentos_eventos;
--   alter table financeiro.lancamentos drop column if exists comprovante_path;
--   (bucket financeiro-comprovantes: remover via dashboard/storage API, migration não dropa bucket)

-- AC-1: comprovante anexado
insert into storage.buckets (id, name, public, file_size_limit)
values ('financeiro-comprovantes', 'financeiro-comprovantes', false, 10485760)
on conflict (id) do nothing;

create policy "financeiro_comprovantes_select" on storage.objects for select to authenticated
  using (bucket_id = 'financeiro-comprovantes'
    and (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita')));
create policy "financeiro_comprovantes_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'financeiro-comprovantes'
    and (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita'));
create policy "financeiro_comprovantes_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'financeiro-comprovantes'
    and (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita'));

alter table financeiro.lancamentos add column comprovante_path text;

-- AC-2: eventos de auditoria — append-only (INSERT só; nunca UPDATE/DELETE, nem pra superadmin).
create table financeiro.lancamentos_eventos (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references financeiro.lancamentos (id),
  tipo text not null check (tipo in ('estorno', 'correcao')),
  campo text,
  valor_anterior text,
  valor_novo text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);

create index idx_lancamentos_eventos_lancamento on financeiro.lancamentos_eventos (lancamento_id);

alter table financeiro.lancamentos_eventos enable row level security;
alter table financeiro.lancamentos_eventos force row level security;
grant select on financeiro.lancamentos_eventos to authenticated;
grant insert on financeiro.lancamentos_eventos to authenticated;
grant select, insert, update, delete on financeiro.lancamentos_eventos to service_role;

create policy "lancamentos_eventos_select_financeiro" on financeiro.lancamentos_eventos for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
create policy "lancamentos_eventos_insert_financeiro" on financeiro.lancamentos_eventos for insert to authenticated
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');
-- sem policy de update/delete — ninguém edita ou apaga evento de auditoria, nem superadmin.

-- AC-3: transferência entre contas — 2 lançamentos vinculados (saída na origem, entrada no
-- destino), origem='transferencia' pra sair das somas de entradas/saídas do dashboard.
-- NOT VALID aqui; VALIDATE em 0118 (migration separada — padrão split da casa, ver 0101/0102).
alter table financeiro.lancamentos drop constraint lancamentos_origem_check;
alter table financeiro.lancamentos
  add constraint lancamentos_origem_check
  check (origem in ('manual', 'ofx', 'recorrencia', 'transferencia')) not valid;

create table financeiro.transferencias (
  id uuid primary key default gen_random_uuid(),
  lancamento_saida_id uuid not null references financeiro.lancamentos (id),
  lancamento_entrada_id uuid not null references financeiro.lancamentos (id),
  conta_origem_id uuid not null references financeiro.contas_bancarias (id),
  conta_destino_id uuid not null references financeiro.contas_bancarias (id),
  valor_centavos integer not null check (valor_centavos > 0),
  data date not null,
  descricao text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);

alter table financeiro.transferencias enable row level security;
alter table financeiro.transferencias force row level security;
grant select on financeiro.transferencias to authenticated;
grant insert on financeiro.transferencias to authenticated;
grant select, insert, update, delete on financeiro.transferencias to service_role;

create policy "transferencias_select_financeiro" on financeiro.transferencias for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
create policy "transferencias_insert_financeiro" on financeiro.transferencias for insert to authenticated
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');

-- Cria os 2 lançamentos + o vínculo numa única transação (função = 1 transação implícita).
-- security invoker: RLS de insert em financeiro.lancamentos/transferencias já exige
-- financeiro:escrita, sem duplicar checagem aqui.
create or replace function financeiro.fn_criar_transferencia(
  p_conta_origem_id uuid,
  p_conta_destino_id uuid,
  p_valor_centavos integer,
  p_data date,
  p_descricao text default null
)
returns uuid
language plpgsql
security invoker
set search_path = financeiro, pg_temp
as $$
declare
  v_categoria_id uuid;
  v_lancamento_saida_id uuid;
  v_lancamento_entrada_id uuid;
  v_transferencia_id uuid;
begin
  if p_conta_origem_id = p_conta_destino_id then
    raise exception 'Conta de origem e destino não podem ser a mesma.' using errcode = '22023';
  end if;
  if p_valor_centavos <= 0 then
    raise exception 'Valor da transferência deve ser maior que zero.' using errcode = '22023';
  end if;

  -- categoria neutra pra transferência (não aparece nos gráficos de gasto por categoria porque
  -- fn_gastos_categoria já filtra por competência+tipo='saida'; ficaria junto de "Outras receitas"/
  -- "Tarifas" se não tivesse a própria; usa a 1a categoria de saída como fallback neutro).
  select id into v_categoria_id from financeiro.categorias where nome = 'Tarifas e juros bancários' limit 1;

  insert into financeiro.lancamentos (tipo, status, valor_centavos, data_competencia, data_pagamento, categoria_id, conta_id, origem, descricao)
  values ('saida', 'realizado', p_valor_centavos, p_data, p_data, v_categoria_id, p_conta_origem_id, 'transferencia', coalesce(p_descricao, 'Transferência entre contas'))
  returning id into v_lancamento_saida_id;

  insert into financeiro.lancamentos (tipo, status, valor_centavos, data_competencia, data_pagamento, categoria_id, conta_id, origem, descricao)
  values ('entrada', 'realizado', p_valor_centavos, p_data, p_data, v_categoria_id, p_conta_destino_id, 'transferencia', coalesce(p_descricao, 'Transferência entre contas'))
  returning id into v_lancamento_entrada_id;

  insert into financeiro.transferencias (lancamento_saida_id, lancamento_entrada_id, conta_origem_id, conta_destino_id, valor_centavos, data, descricao)
  values (v_lancamento_saida_id, v_lancamento_entrada_id, p_conta_origem_id, p_conta_destino_id, p_valor_centavos, p_data, p_descricao)
  returning id into v_transferencia_id;

  return v_transferencia_id;
end;
$$;

revoke all on function financeiro.fn_criar_transferencia(uuid, uuid, integer, date, text) from public;
grant execute on function financeiro.fn_criar_transferencia(uuid, uuid, integer, date, text) to authenticated;

comment on function financeiro.fn_criar_transferencia(uuid, uuid, integer, date, text)
  is 'E04-S07: cria o par de lançamentos (saída+entrada) + vínculo de uma transferência entre contas, atomicamente. origem=transferencia é excluída das somas de entradas/saídas do dashboard (fn_resumo_caixa/fn_fluxo_mensal).';

-- Exclui transferências das somas de entrada/saída do mês (não é resultado, é movimentação
-- interna) — reaplica fn_resumo_caixa (0107) só adicionando o filtro origem<>'transferencia'.
create or replace function financeiro.fn_resumo_caixa()
returns table (
  posicao_caixa_centavos bigint,
  entradas_mes_centavos bigint,
  saidas_mes_centavos bigint,
  resultado_mes_centavos bigint,
  a_receber_30d_centavos bigint,
  a_pagar_30d_centavos bigint,
  entradas_previstas_mes_centavos bigint,
  saidas_previstas_mes_centavos bigint
)
language sql
stable
security invoker
set search_path = financeiro, pg_temp
as $$
  select
    (
      select coalesce(sum(
        cb.saldo_inicial_centavos
        + coalesce((
            select sum(case when l.tipo = 'entrada' then l.valor_centavos else -l.valor_centavos end)
            from financeiro.lancamentos l
            where l.conta_id = cb.id
              and l.status = 'realizado'
              and l.data_pagamento >= cb.saldo_inicial_em
          ), 0)
      ), 0)
      from financeiro.contas_bancarias cb
      where cb.ativo
    ) as posicao_caixa_centavos,
    coalesce((
      select sum(valor_centavos) from financeiro.lancamentos
      where tipo = 'entrada' and status = 'realizado' and origem <> 'transferencia'
        and data_pagamento >= date_trunc('month', current_date)::date
        and data_pagamento < (date_trunc('month', current_date) + interval '1 month')::date
    ), 0) as entradas_mes_centavos,
    coalesce((
      select sum(valor_centavos) from financeiro.lancamentos
      where tipo = 'saida' and status = 'realizado' and origem <> 'transferencia'
        and data_pagamento >= date_trunc('month', current_date)::date
        and data_pagamento < (date_trunc('month', current_date) + interval '1 month')::date
    ), 0) as saidas_mes_centavos,
    coalesce((
      select sum(case when tipo = 'entrada' then valor_centavos else -valor_centavos end)
      from financeiro.lancamentos
      where status = 'realizado' and origem <> 'transferencia'
        and data_pagamento >= date_trunc('month', current_date)::date
        and data_pagamento < (date_trunc('month', current_date) + interval '1 month')::date
    ), 0) as resultado_mes_centavos,
    coalesce((
      select sum(valor_centavos) from financeiro.lancamentos
      where tipo = 'entrada' and status = 'previsto'
        and data_vencimento between current_date and current_date + 30
    ), 0) as a_receber_30d_centavos,
    coalesce((
      select sum(valor_centavos) from financeiro.lancamentos
      where tipo = 'saida' and status = 'previsto'
        and data_vencimento between current_date and current_date + 30
    ), 0) as a_pagar_30d_centavos,
    coalesce((
      select sum(valor_centavos) from financeiro.lancamentos
      where tipo = 'entrada' and status = 'previsto'
        and data_vencimento >= date_trunc('month', current_date)::date
        and data_vencimento < (date_trunc('month', current_date) + interval '1 month')::date
    ), 0) as entradas_previstas_mes_centavos,
    coalesce((
      select sum(valor_centavos) from financeiro.lancamentos
      where tipo = 'saida' and status = 'previsto'
        and data_vencimento >= date_trunc('month', current_date)::date
        and data_vencimento < (date_trunc('month', current_date) + interval '1 month')::date
    ), 0) as saidas_previstas_mes_centavos;
$$;

create or replace function financeiro.fn_fluxo_mensal(p_meses int default 12)
returns table (
  mes date,
  entradas_centavos bigint,
  saidas_centavos bigint,
  resultado_centavos bigint
)
language sql
stable
security invoker
set search_path = financeiro, pg_temp
as $$
  with meses as (
    select date_trunc('month', current_date)::date - (n || ' month')::interval as mes
    from generate_series(0, greatest(p_meses, 1) - 1) as n
  ),
  agregado as (
    select
      date_trunc('month', data_competencia)::date as mes,
      sum(valor_centavos) filter (where tipo = 'entrada') as entradas,
      sum(valor_centavos) filter (where tipo = 'saida') as saidas
    from financeiro.lancamentos
    where status = 'realizado' and origem <> 'transferencia'
      and data_competencia >= (date_trunc('month', current_date) - (greatest(p_meses, 1) - 1 || ' month')::interval)::date
    group by 1
  )
  select
    m.mes::date,
    coalesce(a.entradas, 0) as entradas_centavos,
    coalesce(a.saidas, 0) as saidas_centavos,
    coalesce(a.entradas, 0) - coalesce(a.saidas, 0) as resultado_centavos
  from meses m
  left join agregado a on a.mes = m.mes
  order by m.mes;
$$;
