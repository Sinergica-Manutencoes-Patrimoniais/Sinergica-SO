-- ADR-0072: seletores mínimos; o comando revalida vínculos e autorização.
create function pcm.sso_selecionar_os_visita(p_cliente_id uuid, p_visita_id uuid, p_busca text, p_limite integer, p_apos uuid)
returns table(id uuid, numero text, titulo text, categoria text, status text)
language plpgsql stable security definer set search_path = '' as $$
declare v_busca text := lower(btrim(coalesce(p_busca, '')));
begin
  if p_cliente_id is null or p_visita_id is null or p_limite is null or p_limite < 1 or p_limite > 100 or length(v_busca) > 120 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  if not config.sso_autorizar_acao('visita.confirmar', p_cliente_id)
    or not exists (select 1 from pcm.visitas v where v.id = p_visita_id and v.cliente_id = p_cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select o.id, o.numero, o.titulo, o.categoria, o.status from pcm.ordens_servico o
    where o.client_id = p_cliente_id and o.deleted_at is null and (p_apos is null or o.id > p_apos)
      and (v_busca = '' or strpos(lower(o.numero), v_busca) > 0 or strpos(lower(o.titulo), v_busca) > 0)
      and not exists (select 1 from pcm.visita_ordens_servico vo where vo.os_id = o.id and vo.encerrado_em is null)
    order by o.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_selecionar_os_visita(uuid, uuid, text, integer, uuid) from public, anon;
grant execute on function pcm.sso_selecionar_os_visita(uuid, uuid, text, integer, uuid) to authenticated;

create function pcm.sso_selecionar_funcionarios_visita(
  p_cliente_id uuid, p_visita_id uuid, p_excluir_vinculados boolean, p_busca text, p_limite integer, p_apos uuid
) returns table(id uuid, nome text) language plpgsql stable security definer set search_path = '' as $$
declare v_busca text := lower(btrim(coalesce(p_busca, '')));
begin
  if p_cliente_id is null or p_visita_id is null or p_excluir_vinculados is null or p_limite is null
    or p_limite < 1 or p_limite > 100 or length(v_busca) > 120 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  if not config.sso_autorizar_acao('visita.confirmar', p_cliente_id)
    or not exists (select 1 from pcm.visitas v where v.id = p_visita_id and v.cliente_id = p_cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select f.id, f.nome from pcm.funcionarios f where f.ativo and f.deleted_at is null
    and (p_apos is null or f.id > p_apos) and (v_busca = '' or strpos(lower(f.nome), v_busca) > 0)
    and (not p_excluir_vinculados or not exists (select 1 from pcm.visita_equipes e
      where e.visita_id = p_visita_id and e.funcionario_id = f.id and e.encerrado_em is null))
    order by f.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_selecionar_funcionarios_visita(uuid, uuid, boolean, text, integer, uuid) from public, anon;
grant execute on function pcm.sso_selecionar_funcionarios_visita(uuid, uuid, boolean, text, integer, uuid) to authenticated;
