-- ADR-0142: projeção mínima de alvos do Cliente para conferência; continua fechada.
create function pcm.sso_listar_alvos_cronograma(p_cliente_id uuid,p_tipo text,p_apos uuid,p_busca text,p_limite integer)
returns table(id uuid,nome text) language plpgsql stable security definer set search_path = '' as $$
declare v_busca text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_busca,'')));
begin
  if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then
    raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
  if p_cliente_id is null or p_tipo is null or p_tipo not in ('sistema','componente','grupo')
    or p_limite is null or p_limite not between 1 and 100 or length(v_busca)>120 then
    raise exception 'consulta_invalida' using errcode='22023'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then
    raise exception 'cliente_sem_acesso' using errcode='42501'; end if;
  if p_tipo='sistema' then
    return query select s.id,s.nome from pcm.sistemas s where s.cliente_id=p_cliente_id and s.ativo and s.deleted_at is null
      and (p_apos is null or s.id>p_apos) and position(v_busca in pg_catalog.lower(s.nome))>0 order by s.id limit p_limite;
  elsif p_tipo='componente' then
    return query select e.id,e.nome from pcm.equipamentos e where e.client_id=p_cliente_id and e.ativo and e.deleted_at is null
      and (p_apos is null or e.id>p_apos) and position(v_busca in pg_catalog.lower(e.nome))>0 order by e.id limit p_limite;
  else
    return query select g.id,g.nome from pcm.grupos_quantitativos g where g.cliente_id=p_cliente_id and g.ativo and g.deleted_at is null
      and (p_apos is null or g.id>p_apos) and position(v_busca in pg_catalog.lower(g.nome))>0 order by g.id limit p_limite;
  end if;
end;
$$;
revoke all on function pcm.sso_listar_alvos_cronograma(uuid,text,uuid,text,integer) from public,anon,authenticated,service_role;
