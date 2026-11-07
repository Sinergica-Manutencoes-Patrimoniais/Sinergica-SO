-- ADR-0314: consultas privadas, sujeitas aos gates existentes.
create function pcm.sso_listar_fotos_staging_grupo(p_grupo_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select habilitado from pcm.sso_foto_staging_grupo_gate where id),false) or not coalesce((select habilitado from pcm.sso_fotos_levantamento_gate where id),false) then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
  if auth.uid() is null or p_grupo_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select g.cliente_id into v_cliente from pcm.grupos_quantitativos g where g.id=p_grupo_id and g.ativo and g.deleted_at is null;
  if v_cliente is null or (config.sso_autorizar_acao('cadastro.ler',v_cliente) is not true and config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select x.id,x.criado_em from pcm.sso_foto_staging_grupo x join lateral (select d.decisao from pcm.sso_decisoes_foto_levantamento d where d.foto_id=x.foto_id order by d.revisao desc limit 1) u on u.decisao='aceita'
    where x.grupo_id=p_grupo_id and x.cliente_id=v_cliente and (p_apos is null or x.id>p_apos) order by x.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_fotos_staging_grupo(uuid,uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_caminho_foto_staging_grupo(p_vinculo_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v_nome text;
begin
  if not coalesce((select habilitado from pcm.sso_foto_staging_grupo_gate where id),false) or not coalesce((select habilitado from pcm.sso_fotos_levantamento_gate where id),false) then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
  if auth.uid() is null or p_vinculo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select o.name into v_nome from pcm.sso_foto_staging_grupo x join pcm.grupos_quantitativos g on g.id=x.grupo_id and g.cliente_id=x.cliente_id and g.ativo and g.deleted_at is null
    join pcm.sso_fotos_levantamento f on f.id=x.foto_id and f.cliente_id=x.cliente_id join storage.objects o on o.id=f.objeto_id and o.bucket_id='sso-levantamento-fotos' join storage.buckets b on b.id=o.bucket_id and b.public is false
    join lateral (select d.decisao from pcm.sso_decisoes_foto_levantamento d where d.foto_id=f.id order by d.revisao desc limit 1) u on u.decisao='aceita'
    where x.id=p_vinculo_id and (config.sso_autorizar_acao('cadastro.ler',x.cliente_id) is true or config.sso_autorizar_acao('cadastro.gerir',x.cliente_id) is true);
  if v_nome is null then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return v_nome;
end;
$$;
revoke all on function pcm.sso_caminho_foto_staging_grupo(uuid) from public,anon,authenticated,service_role;
