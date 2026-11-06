-- ADR-0206: consulta somente interna; gate e RPC permanecem fechados.
create function pcm.sso_relatorio_despesas_os(p_cliente_id uuid, p_os_id uuid, p_inicio date, p_fim date)
returns table(despesas bigint, previsto_nao_realizado_centavos numeric, realizado_centavos numeric,
  sem_realizado bigint, vinculos_historicos bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_previsto numeric; v_realizado numeric;
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or p_inicio is null or p_fim is null
    or not isfinite(p_inicio) or not isfinite(p_fim) or p_inicio > p_fim or p_fim - p_inicio > 730 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if config.sso_autorizar_acao('despesa_visita.gerir', p_cliente_id) is not true
    or not exists (select 1 from pcm.ordens_servico o where o.id = p_os_id and o.client_id = p_cliente_id and o.deleted_at is null) then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select g.habilitado from pcm.sso_resumo_despesa_gate g where g.id), false) then
    raise exception 'relatorio_indisponivel' using errcode = '55000'; end if;
  select coalesce(sum(p.valor_centavos) filter (where d.realizado_centavos is null), 0),
    coalesce(sum(p.valor_centavos) filter (where d.realizado_centavos is not null), 0)
    into v_previsto, v_realizado from pcm.despesas_visita d
    join lateral (select r.revisao from pcm.despesa_visita_rateios r where r.despesa_id = d.id order by r.revisao desc limit 1) ult on true
    join pcm.despesa_visita_rateio_parcelas p on p.despesa_id = d.id and p.revisao = ult.revisao
    join pcm.visita_ordens_servico vo on vo.id = p.vinculo_id and vo.visita_id = d.visita_id and vo.cliente_id = d.cliente_id
    where d.cliente_id = p_cliente_id and d.status = 'ativa' and d.data between p_inicio and p_fim and vo.os_id = p_os_id;
  if v_previsto > 9007199254740991 or v_realizado > 9007199254740991 then raise exception 'total_excede_limite' using errcode = '22003'; end if;
  return query select count(distinct d.id), v_previsto, v_realizado,
    count(distinct d.id) filter (where d.realizado_centavos is null), count(distinct vo.id) filter (where vo.encerrado_em is not null)
    from pcm.despesas_visita d
    join lateral (select r.revisao from pcm.despesa_visita_rateios r where r.despesa_id = d.id order by r.revisao desc limit 1) ult on true
    join pcm.despesa_visita_rateio_parcelas p on p.despesa_id = d.id and p.revisao = ult.revisao
    join pcm.visita_ordens_servico vo on vo.id = p.vinculo_id and vo.visita_id = d.visita_id and vo.cliente_id = d.cliente_id
    where d.cliente_id = p_cliente_id and d.status = 'ativa' and d.data between p_inicio and p_fim and vo.os_id = p_os_id;
end;
$$;
revoke all on function pcm.sso_relatorio_despesas_os(uuid, uuid, date, date) from public, anon, authenticated, service_role;
