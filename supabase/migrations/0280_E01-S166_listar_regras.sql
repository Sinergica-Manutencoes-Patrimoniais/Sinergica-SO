-- ADR-0056: projeção por Cliente sem dados comerciais privados.
create function pcm.sso_listar_regras_calendario(p_cliente_id uuid, p_limite integer, p_apos uuid)
returns table(id uuid, serie_id uuid, contrato_id uuid, numero integer, ancora_semana date, dia_semana integer,
  intervalo_semanas integer, hora_inicio time, duracao_minutos integer, deslocamento_minutos integer,
  fuso text, vigencia_inicio date, vigencia_fim date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_limite is null or p_limite < 1 or p_limite > 100 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  if not config.sso_autorizar_acao('plano.gerir', p_cliente_id) then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select r.id, r.serie_id, s.contrato_id, r.numero, r.ancora_semana, r.dia_semana,
    r.intervalo_semanas, r.hora_inicio, r.duracao_minutos, r.deslocamento_minutos, r.fuso, r.vigencia_inicio, r.vigencia_fim
  from pcm.regras_visita_contratual r join pcm.calendario_contratual_series s on s.id = r.serie_id
  where s.cliente_id = p_cliente_id and (p_apos is null or r.id > p_apos)
  order by r.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_regras_calendario(uuid, integer, uuid) from public, anon;
grant execute on function pcm.sso_listar_regras_calendario(uuid, integer, uuid) to authenticated;
