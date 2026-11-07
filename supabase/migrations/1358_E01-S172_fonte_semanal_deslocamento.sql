-- ADR-1204: leitura parcial, independente de OS e sem soma automática.
create function pcm.sso_listar_deslocamentos_semana(
  p_cliente_id uuid, p_semana_inicio date, p_apos uuid default null, p_limite integer default 50
) returns table(visita_id uuid, revisao_visita integer, inicio_em timestamptz, fuso text,
  revisao_declaracao integer, revisao_visita_declarada integer, minutos_por_pessoa integer,
  pessoas_proprias integer, minutos_homem bigint)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_semana_inicio is null or not pg_catalog.isfinite(p_semana_inicio)
    or extract(isodow from p_semana_inicio) <> 1 or p_limite is null or p_limite not between 1 and 100 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  perform 1 from pcm.sso_deslocamento_declarado_gate where id and habilitado for share;
  if not found then raise exception 'deslocamento_bloqueado' using errcode = '55000'; end if;
  perform 1 from pcm.capacidade_demanda_gate where id and habilitado for share;
  if not found then raise exception 'demanda_capacidade_bloqueada' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('capacidade.gerir', p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('visita.confirmar', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if exists (
    select 1 from pcm.visitas v join pcm.sso_deslocamentos_declarados d on d.visita_id = v.id
    where v.cliente_id = p_cliente_id and v.estado not in ('cancelada','concluida')
      and (v.inicio_em at time zone v.fuso)::date >= p_semana_inicio
      and (v.inicio_em at time zone v.fuso)::date < p_semana_inicio + 7
      and (p_apos is null or v.id > p_apos) and d.cliente_id <> p_cliente_id
  ) then raise exception 'historico_indisponivel' using errcode = '42501'; end if;
  return query
    select v.id, v.revisao, v.inicio_em, v.fuso, d.revisao, d.revisao_visita,
      d.minutos_por_pessoa, d.pessoas_proprias, d.minutos_por_pessoa::bigint * d.pessoas_proprias::bigint
    from pcm.visitas v
    left join lateral (select x.revisao, x.revisao_visita, x.minutos_por_pessoa, x.pessoas_proprias
      from pcm.sso_deslocamentos_declarados x where x.visita_id = v.id and x.cliente_id = p_cliente_id
      order by x.revisao desc limit 1) d on true
    where v.cliente_id = p_cliente_id and v.estado not in ('cancelada','concluida')
      and (v.inicio_em at time zone v.fuso)::date >= p_semana_inicio
      and (v.inicio_em at time zone v.fuso)::date < p_semana_inicio + 7
      and (p_apos is null or v.id > p_apos)
    order by v.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_deslocamentos_semana(uuid,date,uuid,integer) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_listar_deslocamentos_semana(uuid,date,uuid,integer) to authenticated;
