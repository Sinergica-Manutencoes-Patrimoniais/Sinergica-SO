-- ADR-0113: vínculos reais de equipe da Visita; não representa toda demanda nem calcula saldo.
create function pcm.sso_listar_vinculos_capacidade_visita(p_cliente_id uuid, p_semana_inicio date, p_apos uuid, p_limite integer)
returns table (participacao_id uuid, visita_id uuid, funcionario_id uuid, inicio_em timestamptz, fuso text, estimativa_minutos integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not config.sso_autorizar_acao('capacidade.gerir', p_cliente_id) then
    raise exception 'capacidade_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_semana_inicio is null or not isfinite(p_semana_inicio) or extract(isodow from p_semana_inicio) <> 1
    or p_limite is null or p_limite not between 1 and 100 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  return query select e.id, v.id, e.funcionario_id, v.inicio_em, v.fuso, e.estimativa_minutos
    from pcm.visita_equipes e join pcm.visitas v on v.id = e.visita_id and v.cliente_id = e.cliente_id
    where e.cliente_id = p_cliente_id and e.encerrado_em is null and v.estado <> 'cancelada'
      and (v.inicio_em at time zone v.fuso)::date >= p_semana_inicio
      and (v.inicio_em at time zone v.fuso)::date < p_semana_inicio + 7
      and (p_apos is null or e.id > p_apos)
    order by e.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_vinculos_capacidade_visita(uuid,date,uuid,integer) from public,anon,service_role;
grant execute on function pcm.sso_listar_vinculos_capacidade_visita(uuid,date,uuid,integer) to authenticated;
