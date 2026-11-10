-- ADR-0320: leitura privada temporária, sem concessão.
create function pcm.sso_listar_fotos_staging_ativo(p_tipo text,p_entidade_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select habilitado from pcm.sso_foto_staging_ativo_gate where id),false) or not coalesce((select habilitado from pcm.sso_fotos_levantamento_gate where id),false) then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
  if auth.uid() is null or p_tipo is null or p_tipo not in ('sistema','componente') or p_entidade_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if p_tipo='sistema' then select s.cliente_id into v_cliente from pcm.sistemas s where s.id=p_entidade_id and s.ativo and s.deleted_at is null;
  else select e.client_id into v_cliente from pcm.equipamentos e where e.id=p_entidade_id and e.tipo='componente' and e.ativo and e.deleted_at is null; end if;
  if v_cliente is null or (config.sso_autorizar_acao('cadastro.ler',v_cliente) is not true and config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select x.id,x.criado_em from pcm.sso_foto_staging_ativo x join lateral (select d.decisao from pcm.sso_decisoes_foto_levantamento d where d.foto_id=x.foto_id order by d.revisao desc limit 1) u on u.decisao='aceita' where x.tipo=p_tipo and x.entidade_id=p_entidade_id and x.cliente_id=v_cliente and (p_apos is null or x.id>p_apos) order by x.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_fotos_staging_ativo(text,uuid,uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_caminho_foto_staging_ativo(p_vinculo_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v_nome text;
begin
  if not coalesce((select habilitado from pcm.sso_foto_staging_ativo_gate where id),false) or not coalesce((select habilitado from pcm.sso_fotos_levantamento_gate where id),false) then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
  if auth.uid() is null or p_vinculo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select o.name into v_nome from pcm.sso_foto_staging_ativo x join pcm.sso_fotos_levantamento f on f.id=x.foto_id and f.cliente_id=x.cliente_id join storage.objects o on o.id=f.objeto_id and o.bucket_id='sso-levantamento-fotos' join storage.buckets b on b.id=o.bucket_id and b.public is false
    join lateral (select d.decisao from pcm.sso_decisoes_foto_levantamento d where d.foto_id=f.id order by d.revisao desc limit 1) u on u.decisao='aceita'
    where x.id=p_vinculo_id and (config.sso_autorizar_acao('cadastro.ler',x.cliente_id) is true or config.sso_autorizar_acao('cadastro.gerir',x.cliente_id) is true)
    and ((x.tipo='sistema' and exists(select 1 from pcm.sistemas s where s.id=x.entidade_id and s.cliente_id=x.cliente_id and s.ativo and s.deleted_at is null)) or (x.tipo='componente' and exists(select 1 from pcm.equipamentos e where e.id=x.entidade_id and e.client_id=x.cliente_id and e.tipo='componente' and e.ativo and e.deleted_at is null)));
  if v_nome is null then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return v_nome;
end;
$$;
revoke all on function pcm.sso_caminho_foto_staging_ativo(uuid) from public,anon,authenticated,service_role;
