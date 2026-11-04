-- ADR-0076: cálculo puro, interno, sem criar Ocorrências.
create function pcm.sso_vencimento_ciclo_calendario(p_base date, p_intervalo integer, p_unidade text, p_ciclo integer)
returns date language plpgsql immutable set search_path = '' as $$
declare v_distancia numeric; v_resultado date;
begin
  if p_base is null or not isfinite(p_base) or p_base < date '0001-01-01' or p_base > date '9999-12-31'
    or p_intervalo is null or p_intervalo < 1 or p_ciclo is null or p_ciclo < 0
    or p_unidade is null or p_unidade not in ('dias', 'semanas', 'meses', 'anos') then
    raise exception 'ciclo_calendario_invalido' using errcode = '22023';
  end if;
  v_distancia := p_intervalo::numeric * p_ciclo::numeric * case p_unidade when 'semanas' then 7 when 'anos' then 12 else 1 end;
  if v_distancia > 2147483647 then raise exception 'ciclo_calendario_excede_limite' using errcode = '22023'; end if;
  begin
    if p_unidade in ('dias', 'semanas') then
      v_resultado := p_base + v_distancia::integer;
    else
      v_resultado := (p_base + pg_catalog.make_interval(months => v_distancia::integer))::date;
    end if;
  exception when datetime_field_overflow or interval_field_overflow or numeric_value_out_of_range then
    raise exception 'ciclo_calendario_excede_limite' using errcode = '22023';
  end;
  if v_resultado < date '0001-01-01' or v_resultado > date '9999-12-31' then
    raise exception 'ciclo_calendario_excede_limite' using errcode = '22023';
  end if;
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_vencimento_ciclo_calendario(date, integer, text, integer) from public, anon, authenticated, service_role;
