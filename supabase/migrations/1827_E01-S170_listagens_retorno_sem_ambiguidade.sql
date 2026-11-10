-- Qualifica colunas em listagens de retorno que também declaram OUT id.
create or replace function pcm.sso_listar_reatestacoes_retorno(
  p_cliente_id uuid,p_retorno_id uuid,p_conferencia_id uuid,p_apos uuid,p_limite integer
) returns table(id uuid,conferencia_nova_id uuid,revisao_decisao integer,revisao_evidencias integer,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select g.habilitado from pcm.validacao_os_gate g where g.id),false)
    or not coalesce((select g.habilitado from pcm.origem_campo_inbox_gate g where g.id),false)
    or not coalesce((select g.habilitado from pcm.sso_conferencia_cobertura_retorno_gate g where g.id),false)
    or not coalesce((select g.habilitado from pcm.sso_revisao_validacao_os_gate g where g.id),false) then
    raise exception 'reatestacao_bloqueada' using errcode='55000';
  end if;
  if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.retorno_os_preparado r where r.id=p_retorno_id and r.cliente_id=p_cliente_id) then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  if p_limite is null or p_limite not between 1 and 100 then
    raise exception 'paginacao_invalida' using errcode='22023';
  end if;
  return query
    select a.id,a.conferencia_nova_id,a.revisao_decisao,a.revisao_evidencias,a.justificativa,a.ator_id,a.criado_em
    from pcm.sso_reatestacoes_cobertura_retorno a
    where a.retorno_id=p_retorno_id and a.conferencia_anterior_id=p_conferencia_id
      and (p_apos is null or a.id>p_apos)
    order by a.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_reatestacoes_retorno(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create or replace function pcm.sso_listar_condicoes_evidencia_retorno(
  p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer
) returns table(id uuid,condicao_estrutural_id uuid,revisao_evidencias integer,revisao_decisao integer,decisoes_resposta bigint,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select g.habilitado from pcm.sso_condicao_evidencia_gate g where g.id),false) then
    raise exception 'condicao_evidencia_bloqueada' using errcode='55000';
  end if;
  if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.retorno_os_preparado r where r.id=p_retorno_id and r.cliente_id=p_cliente_id) then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  if p_limite is null or p_limite not between 1 and 100 then
    raise exception 'paginacao_invalida' using errcode='22023';
  end if;
  return query
    select c.id,c.condicao_estrutural_id,c.revisao_evidencias,c.revisao_decisao,c.decisoes_resposta,c.justificativa,c.ator_id,c.criado_em
    from pcm.sso_condicoes_evidencia_retorno c
    where c.retorno_id=p_retorno_id and (p_apos is null or c.id>p_apos)
    order by c.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_condicoes_evidencia_retorno(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
