-- ADR-0085: seleção operacional sem permissão de gestão cadastral.
create function pcm.sso_selecionar_posicoes_visita(
  p_cliente_id uuid, p_visita_id uuid, p_tipo text, p_area_id uuid,
  p_limite integer, p_apos uuid, p_busca text
) returns table(id uuid, nome text, area_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare v_busca text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_busca, '')));
begin
  if p_cliente_id is null or p_visita_id is null or p_tipo is null or p_tipo not in ('area', 'local')
    or (p_tipo = 'area' and p_area_id is not null) or (p_tipo = 'local' and p_area_id is null)
    or p_limite is null or p_limite < 1 or p_limite > 100 or length(v_busca) > 120 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  if not config.sso_autorizar_acao('visita.confirmar', p_cliente_id)
    or not exists (select 1 from pcm.visitas v where v.id = p_visita_id and v.cliente_id = p_cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_tipo = 'area' then
    return query select a.id, a.nome, null::uuid from pcm.areas a
      where a.cliente_id = p_cliente_id and a.ativo and a.deleted_at is null
        and (p_apos is null or a.id > p_apos) and position(v_busca in pg_catalog.lower(a.nome)) > 0
      order by a.id limit p_limite;
  else
    if not exists (select 1 from pcm.areas a where a.id = p_area_id and a.cliente_id = p_cliente_id and a.ativo and a.deleted_at is null) then
      raise exception 'area_nao_encontrada_ou_sem_acesso' using errcode = '42501';
    end if;
    return query select l.id, l.nome, l.area_id from pcm.locais l
      where l.area_id = p_area_id and l.ativo and l.deleted_at is null
        and (p_apos is null or l.id > p_apos) and position(v_busca in pg_catalog.lower(l.nome)) > 0
      order by l.id limit p_limite;
  end if;
end;
$$;
revoke all on function pcm.sso_selecionar_posicoes_visita(uuid, uuid, text, uuid, integer, uuid, text) from public, anon;
grant execute on function pcm.sso_selecionar_posicoes_visita(uuid, uuid, text, uuid, integer, uuid, text) to authenticated;
