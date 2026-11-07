-- ADR-0090: leitura restrita para gestores; não libera criação múltipla.
create function pcm.sso_listar_ordens_chamado(
  p_cliente_id uuid, p_chamado_id uuid, p_limite integer default 50, p_apos uuid default null
)
returns table (id uuid, numero text, titulo text, status text)
language plpgsql stable security definer set search_path = '' as $$
declare v_legado uuid;
begin
  if p_cliente_id is null or p_chamado_id is null or p_limite is null or p_limite < 1 or p_limite > 100 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if not config.sso_autorizar_acao('chamado.encerrar', p_cliente_id)
    or not exists (select 1 from pcm.chamados c
      where c.id = p_chamado_id and c.cliente_id = p_cliente_id and c.deleted_at is null) then
    raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select c.ordem_servico_id into v_legado from pcm.chamados c where c.id = p_chamado_id;
  -- Inconsistência não pode virar resultado incompleto ou associação a outro Cliente.
  if exists (select 1 from pcm.ordens_servico o where o.chamado_id = p_chamado_id
             and o.deleted_at is null and o.client_id is distinct from p_cliente_id)
    or exists (select 1 from pcm.ordens_servico o
      join pcm.chamados outro on outro.ordem_servico_id = o.id
      where o.chamado_id = p_chamado_id and o.deleted_at is null
        and outro.id <> p_chamado_id and outro.deleted_at is null)
    or (v_legado is not null and (
      not exists (select 1 from pcm.ordens_servico o where o.id = v_legado
        and o.client_id = p_cliente_id and o.deleted_at is null
        and (o.chamado_id is null or o.chamado_id = p_chamado_id))
      or exists (select 1 from pcm.chamados c where c.id <> p_chamado_id
        and c.ordem_servico_id = v_legado and c.deleted_at is null)
    )) then
    raise exception 'vinculo_legado_inconsistente' using errcode = '23514';
  end if;
  return query
    select o.id, o.numero, o.titulo, o.status
    from pcm.ordens_servico o
    where (o.chamado_id = p_chamado_id or (o.id = v_legado and o.chamado_id is null))
      and o.client_id = p_cliente_id
      and o.deleted_at is null and (p_apos is null or o.id > p_apos)
    order by o.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_ordens_chamado(uuid, uuid, integer, uuid) from public, anon;
grant execute on function pcm.sso_listar_ordens_chamado(uuid, uuid, integer, uuid) to authenticated;
