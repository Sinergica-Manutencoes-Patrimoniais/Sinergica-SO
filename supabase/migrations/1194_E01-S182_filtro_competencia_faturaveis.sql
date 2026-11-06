-- ADR-1043: leitura experimental por competência, sem efeito financeiro.
create function financeiro.sso_listar_faturaveis_periodo(
  p_cliente_id uuid, p_status text, p_origem text, p_competencia_inicio date,
  p_competencia_fim date, p_limite integer, p_apos uuid
) returns table(id uuid, origem_tipo text, origem_id uuid, valor_original_centavos bigint,
  valor_conferido_centavos bigint, competencia date, status text, revisao integer)
language plpgsql volatile security definer set search_path = '' as $$
declare v_origem text := nullif(btrim(p_origem), '');
begin
  if p_cliente_id is null or p_limite is null or p_limite not between 1 and 100
    or (p_status is not null and p_status not in ('pendente', 'conferido', 'parcial', 'faturado', 'cancelado'))
    or (v_origem is not null and (length(v_origem) > 64 or v_origem !~ '^[a-z0-9_]+$'))
    or (p_competencia_inicio is not null and (not isfinite(p_competencia_inicio) or extract(day from p_competencia_inicio) <> 1))
    or (p_competencia_fim is not null and (not isfinite(p_competencia_fim) or extract(day from p_competencia_fim) <> 1))
    or (p_competencia_inicio is not null and p_competencia_fim is not null and p_competencia_inicio > p_competencia_fim) then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode = '25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  perform 1 from financeiro.sso_filtro_faturaveis_gate g where g.id for share;
  if not coalesce((select g.habilitado from financeiro.sso_filtro_faturaveis_gate g where g.id), false) then
    raise exception 'indisponivel' using errcode = '55000';
  end if;
  if auth.uid() is null or config.sso_autorizar_acao('faturavel.efetivar', p_cliente_id) is distinct from true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select f.id, f.origem_tipo, f.origem_id, f.valor_original_centavos,
    f.valor_conferido_centavos, f.competencia, f.status, f.revisao
    from financeiro.itens_faturaveis f where f.cliente_id = p_cliente_id
      and (p_status is null or f.status = p_status)
      and (v_origem is null or pg_catalog.strpos(f.origem_tipo, v_origem) > 0)
      and (p_competencia_inicio is null or f.competencia >= p_competencia_inicio)
      and (p_competencia_fim is null or f.competencia <= p_competencia_fim)
      and (p_apos is null or f.id > p_apos)
    order by f.id limit p_limite;
end;
$$;
revoke all on function financeiro.sso_listar_faturaveis_periodo(uuid,text,text,date,date,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_listar_faturaveis_periodo(uuid,text,text,date,date,integer,uuid) to authenticated;
