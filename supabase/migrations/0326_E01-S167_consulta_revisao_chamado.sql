-- ADR-0107: consulta para o formulário fechado por flag; não libera criação 1:N.
create function pcm.sso_consultar_revisao_criacao_os(p_cliente_id uuid, p_chamado_id uuid)
returns table (revisao bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_chamado_id is null
    or config.sso_autorizar_acao('chamado.os.criar', p_cliente_id) is distinct from true then
    raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select c.sso_revisao from pcm.chamados c
    where c.id = p_chamado_id and c.cliente_id = p_cliente_id and c.deleted_at is null;
  if not found then
    raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
end;
$$;
revoke all on function pcm.sso_consultar_revisao_criacao_os(uuid, uuid) from public, anon;
grant execute on function pcm.sso_consultar_revisao_criacao_os(uuid, uuid) to authenticated;
