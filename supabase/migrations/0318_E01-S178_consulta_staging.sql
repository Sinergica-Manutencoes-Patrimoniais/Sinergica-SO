-- ADR-0096. Reverso operacional: revogar EXECUTE das funções e desativar consumidores.
-- Não excluir lotes, linhas, comandos ou auditoria.
create or replace function pcm.sso_listar_levantamentos(
  p_cliente_id uuid, p_limite integer, p_apos uuid
) returns table (id uuid, origem text, chave_origem text, revisao integer, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not config.sso_autorizar_acao('cadastro.gerir', p_cliente_id) then
    raise exception 'levantamento_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_limite is null or p_limite not between 1 and 100 then
    raise exception 'paginacao_invalida' using errcode = '22023';
  end if;
  return query select b.id, b.origem, b.chave_origem, b.revisao, b.criado_em
    from pcm.sso_levantamentos b
    where b.cliente_id = p_cliente_id and (p_apos is null or b.id > p_apos)
    order by b.id limit p_limite;
end;
$$;

create or replace function pcm.sso_listar_linhas_levantamento(
  p_cliente_id uuid, p_lote_id uuid, p_limite integer, p_apos text
) returns table (chave text, tipo text, atributos jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not config.sso_autorizar_acao('cadastro.gerir', p_cliente_id)
     or not exists (select 1 from pcm.sso_levantamentos b where b.id = p_lote_id and b.cliente_id = p_cliente_id) then
    raise exception 'levantamento_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and length(p_apos) > 200) then
    raise exception 'paginacao_invalida' using errcode = '22023';
  end if;
  return query select l.chave, l.tipo, l.atributos
    from pcm.sso_levantamento_linhas l
    where l.lote_id = p_lote_id and (p_apos is null or l.chave > p_apos)
    order by l.chave limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_levantamentos(uuid,integer,uuid) from public, anon, service_role;
revoke all on function pcm.sso_listar_linhas_levantamento(uuid,uuid,integer,text) from public, anon, service_role;
grant execute on function pcm.sso_listar_levantamentos(uuid,integer,uuid) to authenticated;
grant execute on function pcm.sso_listar_linhas_levantamento(uuid,uuid,integer,text) to authenticated;
