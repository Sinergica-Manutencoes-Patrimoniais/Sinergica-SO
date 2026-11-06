-- ADR-0055: projeção mínima para gestor do Cliente, sem valores comerciais.
create function pcm.sso_listar_contratos_calendario(p_cliente_id uuid, p_limite integer, p_apos uuid)
returns table(id uuid, tipo text, status text, vigencia_inicio date, vigencia_fim date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_limite is null or p_limite < 1 or p_limite > 100 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  if not config.sso_autorizar_acao('plano.gerir', p_cliente_id) then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select c.id, c.tipo, c.status, c.vigencia_inicio, c.vigencia_fim
    from comercial.contratos c where c.cliente_id = p_cliente_id and (p_apos is null or c.id > p_apos)
    order by c.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_contratos_calendario(uuid, integer, uuid) from public, anon;
grant execute on function pcm.sso_listar_contratos_calendario(uuid, integer, uuid) to authenticated;
