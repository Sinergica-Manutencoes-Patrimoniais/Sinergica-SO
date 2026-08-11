-- 0181_E03-S03_rpcs_financeiro_para_comercial.sql — Sinérgica SO
-- Story E03-S03. Interface de leitura que o Financeiro publica para o Comercial (ADR-0019 R2) —
-- o motor de precificação nunca faz `select` em `financeiro.*`, só chama estas duas RPCs.
--
-- 1) fn_custo_hora_medio_por_cargo — reusa a MESMA função ponto-no-tempo já usada pela
--    rentabilidade (`financeiro._fn_custo_hora_funcionario`, E04-S06), aplicada a todos os
--    funcionários ativos daquele cargo e tirando a média. Sem funcionário no cargo (ou sem custo
--    vigente), devolve null — o AC-4 trata null como "sem dado", nunca zero.
--
-- 2) fn_aliquota_efetiva_atual — extrai só a PARTE de cálculo de alíquota de
--    `fn_provisionar_imposto` (E04-S10), sem os efeitos colaterais dela (não cria/atualiza
--    lançamento nem provisão — isto é read-only). `confirmada = (updated_by is not null)`: sinal
--    honesto de que a configuração já foi tocada por um humano, não é mais só o seed da migration.
--
-- Rollback:
--   drop function if exists financeiro.fn_aliquota_efetiva_atual();
--   drop function if exists financeiro.fn_custo_hora_medio_por_cargo(text);

create or replace function financeiro.fn_custo_hora_medio_por_cargo(p_cargo text)
returns numeric
language plpgsql
stable
security definer
set search_path = financeiro, pcm, pg_temp
as $$
declare
  v_media numeric;
begin
  if coalesce(
    (auth.jwt() ->> 'user_role') = 'superadmin'
    or (auth.jwt() -> 'user_modulos' ->> 'comercial') in ('leitura', 'escrita')
    or (auth.jwt() -> 'user_modulos' ->> 'financeiro') in ('leitura', 'escrita'),
    false
  ) is not true then
    raise exception 'permission denied for function fn_custo_hora_medio_por_cargo'
      using errcode = '42501';
  end if;

  if p_cargo is null or btrim(p_cargo) = '' then
    return null;
  end if;

  select avg(financeiro._fn_custo_hora_funcionario(f.id, current_date))
    into v_media
  from pcm.funcionarios f
  where f.cargo = p_cargo
    and f.ativo
    and f.deleted_at is null;

  return v_media;  -- null quando nenhum funcionário do cargo tem custo vigente cadastrado
end;
$$;

revoke all on function financeiro.fn_custo_hora_medio_por_cargo(text) from public;
grant execute on function financeiro.fn_custo_hora_medio_por_cargo(text) to authenticated;

create or replace function financeiro.fn_aliquota_efetiva_atual()
returns table(aliquota_efetiva numeric, tipo text, confirmada boolean)
language plpgsql
stable
security definer
set search_path = financeiro, pg_temp
as $$
declare
  v_config financeiro.config_impostos%rowtype;
  v_rbt12 bigint;
  v_aliquota numeric(8, 6);
  v_faixa jsonb;
  v_hoje date := current_date;
begin
  if coalesce(
    (auth.jwt() ->> 'user_role') = 'superadmin'
    or (auth.jwt() -> 'user_modulos' ->> 'comercial') in ('leitura', 'escrita')
    or (auth.jwt() -> 'user_modulos' ->> 'financeiro') in ('leitura', 'escrita'),
    false
  ) is not true then
    raise exception 'permission denied for function fn_aliquota_efetiva_atual' using errcode = '42501';
  end if;

  select * into v_config from financeiro.config_impostos where id = 1 and ativo;
  if not found then
    -- Sem config ativa: 0% é mais seguro do que travar a tela de preço — a proposta sai sem
    -- imposto embutido, e o aviso de "não confirmado" (confirmada=false) cobre o caso.
    return query select 0::numeric, 'fixa'::text, false;
    return;
  end if;

  if v_config.tipo = 'fixa' then
    v_aliquota := coalesce(v_config.aliquota_fixa, 0);
  else
    select coalesce(sum(l.valor_centavos), 0) into v_rbt12
    from financeiro.lancamentos l
    where l.tipo = 'entrada'
      and l.data_competencia between (date_trunc('month', v_hoje) - interval '11 months')::date
                                  and (date_trunc('month', v_hoje) + interval '1 month' - interval '1 day')::date;

    if v_rbt12 <= 0 then
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
  end if;

  return query select v_aliquota, v_config.tipo, (v_config.updated_by is not null);
end;
$$;

revoke all on function financeiro.fn_aliquota_efetiva_atual() from public;
grant execute on function financeiro.fn_aliquota_efetiva_atual() to authenticated;

comment on function financeiro.fn_custo_hora_medio_por_cargo(text) is
  'E03-S03: interface de leitura publicada para o motor de preço do Comercial (ADR-0019 R2). '
  'Reusa financeiro._fn_custo_hora_funcionario (E04-S06) por funcionário, tira a média do cargo.';
comment on function financeiro.fn_aliquota_efetiva_atual() is
  'E03-S03: mesma fórmula de fn_provisionar_imposto (E04-S10), sem efeito colateral (não grava '
  'lançamento/provisão). confirmada=false avisa que a config nunca foi tocada por um humano.';
