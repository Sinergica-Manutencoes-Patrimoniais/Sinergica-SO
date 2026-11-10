-- ADR-0077: prévia informativa baseada exclusivamente no snapshot aprovado.
create or replace function pcm.sso_prever_ciclos_rotina(p_plano_id uuid, p_versao_id uuid, p_rotina_id uuid, p_inicio date, p_fim date)
returns table(ciclo integer, vencimento date, tolerancia_antes integer, tolerancia_depois integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cliente uuid; v_versao pcm.plano_versoes%rowtype; v_rotina jsonb; v_quantidade integer;
  v_base date; v_intervalo integer; v_unidade text; v_inicio date; v_fim date;
  v_distancia numeric; v_passo numeric; v_indice numeric; v_data date;
begin
  if p_plano_id is null or p_versao_id is null or p_rotina_id is null or p_inicio is null or p_fim is null
    or not isfinite(p_inicio) or not isfinite(p_fim) or p_inicio < date '0001-01-01' or p_fim > date '9999-12-31'
    or p_fim < p_inicio or p_fim - p_inicio > 366 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  select p.cliente_id into v_cliente from pcm.planos_manutencao p where p.id = p_plano_id;
  if v_cliente is null or not config.sso_autorizar_acao('plano.gerir', v_cliente) then
    raise exception 'plano_ou_versao_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_versao from pcm.plano_versoes v where v.id = p_versao_id and v.plano_id = p_plano_id;
  if not found then raise exception 'plano_ou_versao_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  if v_versao.estado <> 'aprovado' or v_versao.vigencia_inicio is null
    or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then
    raise exception 'snapshot_historico_indisponivel' using errcode = '23514';
  end if;
  select count(*), min(r.item::text)::jsonb into v_quantidade, v_rotina
    from jsonb_array_elements(v_versao.snapshot->'rotinas') r(item) where r.item->>'id' = p_rotina_id::text;
  if v_quantidade <> 1 or v_rotina->>'modo' is distinct from 'calendario' then
    raise exception 'rotina_calendario_indisponivel' using errcode = '23514';
  end if;
  begin
    v_base := (v_rotina->>'data_base')::date;
    v_intervalo := (v_rotina->>'intervalo_n')::integer;
    v_unidade := v_rotina->>'intervalo_unidade';
    tolerancia_antes := (v_rotina->>'tolerancia_antes')::integer;
    tolerancia_depois := (v_rotina->>'tolerancia_depois')::integer;
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
    raise exception 'snapshot_historico_invalido' using errcode = '23514';
  end;
  if v_base is null or not isfinite(v_base) or v_base < date '0001-01-01' or v_base > date '9999-12-31'
    or v_intervalo is null or v_intervalo < 1 or v_unidade is null or v_unidade not in ('dias','semanas','meses','anos')
    or tolerancia_antes is null or tolerancia_antes < 0 or tolerancia_depois is null or tolerancia_depois < 0 then
    raise exception 'snapshot_historico_invalido' using errcode = '23514';
  end if;
  v_inicio := greatest(p_inicio, v_versao.vigencia_inicio);
  v_fim := least(p_fim, coalesce(v_versao.vigencia_fim, p_fim));
  if v_inicio > v_fim then return; end if;
  v_passo := v_intervalo::numeric * case v_unidade when 'semanas' then 7 when 'anos' then 12 else 1 end;
  if v_unidade in ('dias','semanas') then v_distancia := v_inicio - v_base;
  else v_distancia := (extract(year from v_inicio) - extract(year from v_base)) * 12 + extract(month from v_inicio) - extract(month from v_base); end if;
  v_indice := greatest(0, floor(v_distancia / v_passo));
  loop
    if v_indice > 2147483647 then exit; end if;
    begin
      v_data := pcm.sso_vencimento_ciclo_calendario(v_base, v_intervalo, v_unidade, v_indice::integer);
    exception when sqlstate '22023' then exit; end;
    exit when v_data > v_fim;
    if v_data >= v_inicio then ciclo := v_indice::integer; vencimento := v_data; return next; end if;
    v_indice := v_indice + 1;
  end loop;
end;
$$;
revoke all on function pcm.sso_prever_ciclos_rotina(uuid, uuid, uuid, date, date) from public, anon;
grant execute on function pcm.sso_prever_ciclos_rotina(uuid, uuid, uuid, date, date) to authenticated;
