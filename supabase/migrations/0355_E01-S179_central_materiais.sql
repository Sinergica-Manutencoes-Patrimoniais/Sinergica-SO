-- ADR-0130: consulta central preparada; não conceder execução antes dos gates.
create function pcm.sso_consultar_central_materiais(
  p_cliente_id uuid, p_ordem_servico_id uuid, p_responsavel text,
  p_limite integer, p_apos uuid default null
) returns table(id uuid, ordem_servico_id uuid, responsavel text, texto_original text, estado text, revisao integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_limite is null or p_limite not between 1 and 100
    or (p_responsavel is not null and p_responsavel not in ('cliente', 'sinergica')) then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if config.sso_autorizar_acao('material.gerir', p_cliente_id) is not true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select l.id, l.ordem_servico_id, l.responsavel, l.texto_original, l.estado, l.revisao
    from pcm.listas_materiais l join pcm.ordens_servico o
      on o.id = l.ordem_servico_id and o.client_id = l.cliente_id and o.deleted_at is null
    where l.cliente_id = p_cliente_id
      and (p_ordem_servico_id is null or l.ordem_servico_id = p_ordem_servico_id)
      and (p_responsavel is null or l.responsavel = p_responsavel)
      and (p_apos is null or l.id > p_apos)
    order by l.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_consultar_central_materiais(uuid, uuid, text, integer, uuid)
  from public, anon, authenticated, service_role;
