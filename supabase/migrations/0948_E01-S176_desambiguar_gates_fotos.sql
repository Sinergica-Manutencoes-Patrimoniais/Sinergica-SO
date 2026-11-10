-- ADR-0723: qualificar os gates sem mudar assinatura, filtros ou ACL.
create or replace function pcm.sso_listar_fotos_staging_ativo(p_tipo text,p_entidade_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select g.habilitado from pcm.sso_foto_staging_ativo_gate g where g.id),false) or not coalesce((select g.habilitado from pcm.sso_fotos_levantamento_gate g where g.id),false) then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
  if auth.uid() is null or p_tipo is null or p_tipo not in ('sistema','componente') or p_entidade_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if p_tipo='sistema' then select s.cliente_id into v_cliente from pcm.sistemas s where s.id=p_entidade_id and s.ativo and s.deleted_at is null;
  else select e.client_id into v_cliente from pcm.equipamentos e where e.id=p_entidade_id and e.tipo='componente' and e.ativo and e.deleted_at is null; end if;
  if v_cliente is null or (config.sso_autorizar_acao('cadastro.ler',v_cliente) is not true and config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query
    select x.id,x.criado_em
    from pcm.sso_foto_staging_ativo x
    join lateral (select d.decisao from pcm.sso_decisoes_foto_levantamento d where d.foto_id=x.foto_id order by d.revisao desc limit 1) u on u.decisao='aceita'
    where x.tipo=p_tipo and x.entidade_id=p_entidade_id and x.cliente_id=v_cliente
      and not pcm.sso_foto_inadequada(x.foto_id)
      and (p_apos is null or x.id>p_apos)
    order by x.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_fotos_staging_ativo(text,uuid,uuid,integer) from public,anon,authenticated,service_role;
