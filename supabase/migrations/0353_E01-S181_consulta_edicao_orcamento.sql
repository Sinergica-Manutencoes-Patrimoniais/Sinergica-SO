-- ADR-0128: projeção contextual fechada; sem concessão para a aplicação.
create function comercial.sso_listar_edicao_orcamentos_os(
  p_cliente_id uuid, p_ordem_servico_id uuid, p_limite integer, p_apos uuid default null
) returns table(id uuid, status text, versao integer, lista_id uuid, lista_revisao integer)
language sql stable security definer set search_path = '' as $$
  select p.id, p.status, p.versao, l.id, l.revisao
  from comercial.sso_listar_orcamentos_os(p_cliente_id, p_ordem_servico_id, p_limite, p_apos) p
  join comercial.proposta_origens_operacionais v on v.proposta_id = p.id
  join pcm.listas_materiais l on l.id = v.lista_materiais_id
  where v.ordem_servico_id = p_ordem_servico_id
    and l.ordem_servico_id = p_ordem_servico_id
    and l.cliente_id = p_cliente_id
  order by p.id;
$$;
revoke all on function comercial.sso_listar_edicao_orcamentos_os(uuid, uuid, integer, uuid)
  from public, anon, authenticated, service_role;
