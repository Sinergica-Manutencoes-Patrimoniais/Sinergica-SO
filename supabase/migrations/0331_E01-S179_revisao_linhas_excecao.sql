-- ADR-0105/0109: expõe identidade histórica do snapshot para exceções por linha.
create function pcm.sso_obter_snapshot_linhas_materiais(p_lista_id uuid, p_revisao integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_lista pcm.listas_materiais%rowtype; v_linhas jsonb; v_revisao integer;
begin
  select * into v_lista from pcm.listas_materiais where id = p_lista_id;
  if not found or config.sso_autorizar_acao('material.gerir', v_lista.cliente_id) is not true
    or not exists(select 1 from pcm.ordens_servico o where o.id = v_lista.ordem_servico_id
      and o.client_id = v_lista.cliente_id and o.deleted_at is null) then
    raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_revisao is null or p_revisao < 1 or p_revisao > v_lista.revisao then
    raise exception 'revisao_invalida' using errcode = '22023';
  end if;
  select s.revisao, s.linhas into v_revisao, v_linhas from pcm.sso_lista_materiais_versoes s
    where s.lista_id = p_lista_id and s.revisao <= p_revisao order by s.revisao desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object('revisao', v_revisao, 'linhas', v_linhas);
end;
$$;
revoke all on function pcm.sso_obter_snapshot_linhas_materiais(uuid, integer) from public, anon, service_role;
grant execute on function pcm.sso_obter_snapshot_linhas_materiais(uuid, integer) to authenticated;
