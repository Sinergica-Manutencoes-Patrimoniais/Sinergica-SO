-- Evita ambiguidade entre OUT id e colunas em listagem mediada de cobertura.
create or replace function pcm.sso_listar_conferencias_cobertura_retorno(
  p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer
) returns table(id uuid,evidencia_id uuid,revisao_evidencias integer,perguntas integer,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select g.habilitado from pcm.validacao_os_gate g where g.id),false)
    or not coalesce((select g.habilitado from pcm.origem_campo_inbox_gate g where g.id),false)
    or not coalesce((select g.habilitado from pcm.sso_conferencia_cobertura_retorno_gate g where g.id),false) then
    raise exception 'conferencia_cobertura_bloqueada' using errcode='55000';
  end if;
  if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.retorno_os_preparado r where r.id=p_retorno_id and r.cliente_id=p_cliente_id) then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  if p_limite is null or p_limite not between 1 and 100 then
    raise exception 'paginacao_invalida' using errcode='22023';
  end if;
  return query
    select c.id,c.evidencia_id,c.revisao_evidencias,c.perguntas,c.justificativa,c.ator_id,c.criado_em
    from pcm.sso_conferencias_cobertura_retorno c
    where c.retorno_id=p_retorno_id and (p_apos is null or c.id>p_apos)
    order by c.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_conferencias_cobertura_retorno(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
