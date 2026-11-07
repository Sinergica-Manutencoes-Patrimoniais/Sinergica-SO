-- ADR-0714: consulta aditiva, sem grants; não aplicar antes de revisão e testes.
create function financeiro.sso_saldo_unificado_faturavel(p_cliente_id uuid, p_item_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_resultado jsonb;
begin
  if auth.uid() is null or p_cliente_id is null or p_item_id is null
    or config.sso_autorizar_acao('faturavel.efetivar', p_cliente_id) is distinct from true then
    raise exception 'item_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if not coalesce((select habilitado from financeiro.sso_selecao_documento_gate where id), false)
    or not coalesce((select habilitado from financeiro.sso_documento_interno_gate where id), false) then
    raise exception 'saldo_indisponivel' using errcode = '55000';
  end if;
  select jsonb_build_object(
    'itemId', i.id, 'revisao', i.revisao,
    'situacao', case when i.valor_conferido_centavos is null then 'nao_conferido'
      when i.valor_conferido_centavos - a.alocado - r.reservado < 0 then 'divergente' else 'calculado' end,
    'conferidoCentavos', i.valor_conferido_centavos::text,
    'alocadoCentavos', a.alocado::text, 'reservadoCentavos', r.reservado::text,
    'disponivelCentavos', case when i.valor_conferido_centavos is not null
      and i.valor_conferido_centavos - a.alocado - r.reservado >= 0
      then (i.valor_conferido_centavos - a.alocado - r.reservado)::text else null end
  ) into v_resultado
  from financeiro.itens_faturaveis i
  cross join lateral (select (financeiro.sso_totais_alocacoes_ativas(i.id, null)->>'itemCentavos')::numeric as alocado) a
  cross join lateral (select coalesce(sum(d.valor_centavos), 0) as reservado
    from financeiro.sso_documentos_internos d
    where d.item_id = i.id and d.cliente_id = i.cliente_id
      and not exists (select 1 from financeiro.sso_documentos_internos_liberacoes l where l.documento_interno_id = d.id)) r
  where i.id = p_item_id and i.cliente_id = p_cliente_id;
  if not found then raise exception 'item_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  return v_resultado;
end $$;
revoke all on function financeiro.sso_saldo_unificado_faturavel(uuid, uuid) from public, anon, authenticated, service_role;
