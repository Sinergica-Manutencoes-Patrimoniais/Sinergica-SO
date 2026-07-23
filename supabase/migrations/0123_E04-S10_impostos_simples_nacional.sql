-- 0123_E04-S10_impostos_simples_nacional.sql
-- Provisão gerencial de imposto (Simples Nacional/DAS) por competência — AC-1..AC-4. NÃO é apuração
-- fiscal oficial (fora de escopo, vinculante). `financeiro.config_impostos` é singleton (id fixo=1,
-- check garante só 1 linha) — alíquota fixa OU faixas de RBT12 (jsonb, fórmula oficial do Simples:
-- efetiva = (RBT12*nominal - parcela_deduzir)/RBT12). `financeiro.provisoes_imposto` é o registro
-- auditável por competência (1 por mês, chave natural) — guarda receita/RBT12/alíquota usados no
-- cálculo, permitindo recalcular numa retificação sem perder o histórico do que já foi calculado
-- antes.
-- Reverso:
--   drop function if exists financeiro.fn_provisionar_imposto(date);
--   drop table if exists financeiro.provisoes_imposto;
--   drop table if exists financeiro.config_impostos;

create table financeiro.config_impostos (
  id int primary key default 1,
  tipo text not null check (tipo in ('fixa', 'faixa_rbt12')),
  aliquota_fixa numeric(8, 6),
  faixas jsonb not null default '[]'::jsonb,
  dia_vencimento int not null default 20 check (dia_vencimento between 1 and 28),
  ativo boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  constraint config_impostos_singleton check (id = 1)
);

alter table financeiro.config_impostos enable row level security;
alter table financeiro.config_impostos force row level security;
grant select on financeiro.config_impostos to authenticated;
grant insert, update on financeiro.config_impostos to authenticated;
grant select, insert, update, delete on financeiro.config_impostos to service_role;

create policy "config_impostos_select_financeiro" on financeiro.config_impostos for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
create policy "config_impostos_escrita_financeiro" on financeiro.config_impostos for all to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');

create table financeiro.provisoes_imposto (
  competencia date primary key,
  lancamento_id uuid references financeiro.lancamentos (id) on delete set null,
  receita_centavos bigint not null,
  rbt12_centavos bigint not null,
  aliquota_efetiva numeric(8, 6) not null,
  valor_centavos bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table financeiro.provisoes_imposto enable row level security;
alter table financeiro.provisoes_imposto force row level security;
grant select on financeiro.provisoes_imposto to authenticated;
grant insert, update, delete on financeiro.provisoes_imposto to authenticated;
grant select, insert, update, delete on financeiro.provisoes_imposto to service_role;

create policy "provisoes_imposto_select_financeiro" on financeiro.provisoes_imposto for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'financeiro' in ('leitura', 'escrita'));
create policy "provisoes_imposto_escrita_financeiro" on financeiro.provisoes_imposto for all to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'financeiro' = 'escrita');

-- AC-2/AC-3/AC-4: calcula e provisiona o imposto da competência informada. `security invoker`: RLS
-- de INSERT em financeiro.lancamentos já exige financeiro:escrita, sem duplicar checagem aqui.
create or replace function financeiro.fn_provisionar_imposto(p_competencia date)
returns table (
  competencia date,
  receita_centavos bigint,
  rbt12_centavos bigint,
  aliquota_efetiva numeric,
  valor_centavos bigint,
  lancamento_id uuid
)
language plpgsql
security invoker
set search_path = financeiro, pg_temp
as $$
declare
  v_mes_inicio date := date_trunc('month', p_competencia)::date;
  v_mes_fim date := (date_trunc('month', p_competencia) + interval '1 month' - interval '1 day')::date;
  v_config financeiro.config_impostos%rowtype;
  v_receita bigint;
  v_rbt12 bigint;
  v_aliquota numeric(8, 6);
  v_valor bigint;
  v_categoria_id uuid;
  v_existente financeiro.provisoes_imposto%rowtype;
  v_lancamento_status text;
  v_lancamento_id uuid;
  v_faixa jsonb;
begin
  select * into v_config from financeiro.config_impostos where id = 1 and ativo;
  if not found then
    raise exception 'Configuração de impostos não definida ou inativa (Configurações > Impostos).' using errcode = '22023';
  end if;

  select coalesce(sum(l.valor_centavos), 0) into v_receita
  from financeiro.lancamentos l
  where l.tipo = 'entrada' and l.data_competencia between v_mes_inicio and v_mes_fim;

  select coalesce(sum(l.valor_centavos), 0) into v_rbt12
  from financeiro.lancamentos l
  where l.tipo = 'entrada'
    and l.data_competencia between (v_mes_inicio - interval '11 months')::date and v_mes_fim;

  if v_config.tipo = 'fixa' then
    v_aliquota := coalesce(v_config.aliquota_fixa, 0);
  elsif v_rbt12 <= 0 then
    v_aliquota := 0;
  else
    select f into v_faixa
    from jsonb_array_elements(v_config.faixas) as f
    where (f ->> 'ateRbt12Centavos') is null or v_rbt12 <= (f ->> 'ateRbt12Centavos')::bigint
    order by coalesce((f ->> 'ateRbt12Centavos')::bigint, 9223372036854775807) asc
    limit 1;

    if v_faixa is null then
      v_aliquota := 0;
    else
      v_aliquota := greatest(
        (v_rbt12 * (v_faixa ->> 'aliquotaNominal')::numeric - (v_faixa ->> 'parcelaDeduzirCentavos')::bigint) / v_rbt12,
        0
      );
    end if;
  end if;

  v_valor := round(v_receita * v_aliquota);

  select * into v_existente from financeiro.provisoes_imposto p where p.competencia = v_mes_inicio;

  if v_existente.competencia is not null then
    select l.status into v_lancamento_status from financeiro.lancamentos l where l.id = v_existente.lancamento_id;
  end if;

  -- Receita zero (ou provisão zerada numa retificação): remove o pagável se ainda não foi pago;
  -- nunca mexe num imposto já realizado (pago) — fica pra ajuste manual humano.
  if v_valor <= 0 then
    if v_existente.competencia is not null and v_lancamento_status = 'previsto' then
      delete from financeiro.lancamentos where id = v_existente.lancamento_id;
      delete from financeiro.provisoes_imposto where competencia = v_mes_inicio;
    end if;
    return query select v_mes_inicio, v_receita, v_rbt12, v_aliquota, 0::bigint, null::uuid;
    return;
  end if;

  select id into v_categoria_id from financeiro.categorias where nome = 'Impostos e taxas' and parent_id is null limit 1;

  if v_existente.competencia is null then
    insert into financeiro.lancamentos (tipo, status, valor_centavos, data_competencia, data_vencimento, categoria_id, origem, descricao)
    values ('saida', 'previsto', v_valor, v_mes_inicio,
            (v_mes_fim + 1) + (v_config.dia_vencimento - 1), v_categoria_id, 'recorrencia',
            'Provisão de imposto (Simples Nacional/DAS) — ' || to_char(v_mes_inicio, 'MM/YYYY'))
    returning id into v_lancamento_id;

    insert into financeiro.provisoes_imposto (competencia, lancamento_id, receita_centavos, rbt12_centavos, aliquota_efetiva, valor_centavos)
    values (v_mes_inicio, v_lancamento_id, v_receita, v_rbt12, v_aliquota, v_valor);
  else
    v_lancamento_id := v_existente.lancamento_id;
    if v_lancamento_status = 'previsto' then
      update financeiro.lancamentos set valor_centavos = v_valor, updated_at = now() where id = v_lancamento_id;
    end if;
    update financeiro.provisoes_imposto
    set receita_centavos = v_receita, rbt12_centavos = v_rbt12, aliquota_efetiva = v_aliquota,
        valor_centavos = v_valor, updated_at = now()
    where competencia = v_mes_inicio;
  end if;

  return query select v_mes_inicio, v_receita, v_rbt12, v_aliquota, v_valor, v_lancamento_id;
end;
$$;

revoke all on function financeiro.fn_provisionar_imposto(date) from public;
grant execute on function financeiro.fn_provisionar_imposto(date) to authenticated;

comment on function financeiro.fn_provisionar_imposto(date)
  is 'E04-S10: calcula e provisiona (idempotente, recalcula em retificação) o imposto da competência — nunca mexe num imposto já realizado (pago).';
