-- ADR-0071: projeção mínima e paginação de vínculos de OS e equipe.
create function pcm.sso_listar_os_visita(
  p_cliente_id uuid, p_visita_id uuid, p_incluir_historico boolean, p_limite integer,
  p_apos_sequencia integer, p_apos_id uuid
) returns table(id uuid, os_id uuid, numero text, titulo text, categoria text, sequencia integer,
  estimativa_minutos integer, created_at timestamptz, encerrado_em timestamptz, encerrado_por uuid, encerramento_motivo text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_visita_id is null or p_incluir_historico is null or p_limite is null or p_limite < 1 or p_limite > 100
    or ((p_apos_sequencia is null) <> (p_apos_id is null)) or (p_apos_sequencia is not null and p_apos_sequencia < 1) then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  if not config.sso_autorizar_acao('visita.confirmar', p_cliente_id)
    or not exists (select 1 from pcm.visitas v where v.id = p_visita_id and v.cliente_id = p_cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select o.id, o.os_id, s.numero, s.titulo, s.categoria, o.sequencia, o.estimativa_minutos,
    o.created_at, o.encerrado_em, o.encerrado_por, o.encerramento_motivo
    from pcm.visita_ordens_servico o join pcm.ordens_servico s on s.id = o.os_id and s.client_id = o.cliente_id
    where o.visita_id = p_visita_id and o.cliente_id = p_cliente_id and (p_incluir_historico or o.encerrado_em is null)
      and (p_apos_sequencia is null or (o.sequencia, o.id) > (p_apos_sequencia, p_apos_id))
    order by o.sequencia, o.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_os_visita(uuid, uuid, boolean, integer, integer, uuid) from public, anon;
grant execute on function pcm.sso_listar_os_visita(uuid, uuid, boolean, integer, integer, uuid) to authenticated;

create function pcm.sso_listar_equipe_visita(
  p_cliente_id uuid, p_visita_id uuid, p_incluir_historico boolean, p_limite integer, p_apos_id uuid
) returns table(id uuid, funcionario_id uuid, nome text, papel text, estimativa_minutos integer,
  created_at timestamptz, encerrado_em timestamptz, encerrado_por uuid, encerramento_motivo text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_visita_id is null or p_incluir_historico is null or p_limite is null or p_limite < 1 or p_limite > 100 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  if not config.sso_autorizar_acao('visita.confirmar', p_cliente_id)
    or not exists (select 1 from pcm.visitas v where v.id = p_visita_id and v.cliente_id = p_cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select e.id, e.funcionario_id, f.nome, e.papel, e.estimativa_minutos,
    e.created_at, e.encerrado_em, e.encerrado_por, e.encerramento_motivo
    from pcm.visita_equipes e join pcm.funcionarios f on f.id = e.funcionario_id
    where e.visita_id = p_visita_id and e.cliente_id = p_cliente_id and (p_incluir_historico or e.encerrado_em is null)
      and (p_apos_id is null or e.id > p_apos_id) order by e.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_equipe_visita(uuid, uuid, boolean, integer, uuid) from public, anon;
grant execute on function pcm.sso_listar_equipe_visita(uuid, uuid, boolean, integer, uuid) to authenticated;
