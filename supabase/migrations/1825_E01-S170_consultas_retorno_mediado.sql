-- Corrige referência ambígua entre OUT id e a coluna id do gate.
-- Mantém autorização, gate fechado por padrão, isolamento e núcleo privado.
create or replace function pcm.sso_listar_evidencias_declaradas(
  p_cliente_id uuid,p_retorno_id uuid,p_apos integer,p_limite integer
) returns table(id uuid,revisao integer,tipo text,referencia text,descricao text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select g.habilitado from pcm.origem_campo_inbox_gate g where g.id),false)
    or not coalesce((select g.habilitado from pcm.validacao_os_gate g where g.id),false) then
    raise exception 'retorno_campo_bloqueado' using errcode='55000';
  end if;
  if auth.uid() is null or p_cliente_id is null or p_retorno_id is null
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or not exists(
      select 1 from pcm.retorno_os_preparado r
      join pcm.ordens_servico os on os.id=r.os_id and os.client_id=r.cliente_id and os.deleted_at is null
      where r.id=p_retorno_id and r.cliente_id=p_cliente_id
    ) then
    raise exception 'retorno_nao_encontrado_ou_sem_acesso' using errcode='42501';
  end if;
  if p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then
    raise exception 'paginacao_invalida' using errcode='22023';
  end if;
  return query
    select e.id,e.revisao,e.tipo,e.referencia,e.descricao,e.ator_id,e.criado_em
    from pcm.retorno_evidencias_declaradas e
    where e.retorno_id=p_retorno_id and (p_apos is null or e.revisao>p_apos)
    order by e.revisao limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_evidencias_declaradas(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;

