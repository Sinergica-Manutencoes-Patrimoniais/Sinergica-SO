-- ADR-0719: mediação sem concessão dos núcleos ou tabelas.
create function pcm.sso_consultar_destino_foto_ativo_mediado(p_foto_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if auth.uid() is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  select cliente_id into v_cliente from pcm.sso_fotos_levantamento where id=p_foto_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true or config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true then
    raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501';
  end if;
  return pcm.sso_consultar_destino_foto_ativo(p_foto_id);
end; $$;
revoke all on function pcm.sso_consultar_destino_foto_ativo_mediado(uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_destino_foto_ativo_mediado(uuid) to authenticated;

create function pcm.sso_vincular_foto_staging_ativo_mediado(p_request_id uuid,p_foto_id uuid,p_tipo text,p_entidade_id uuid,p_decisao_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if auth.uid() is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  select cliente_id into v_cliente from pcm.sso_fotos_levantamento where id=p_foto_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true or config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true then
    raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501';
  end if;
  return pcm.sso_vincular_foto_staging_ativo(p_request_id,p_foto_id,p_tipo,p_entidade_id,p_decisao_revision);
end; $$;
revoke all on function pcm.sso_vincular_foto_staging_ativo_mediado(uuid,uuid,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_vincular_foto_staging_ativo_mediado(uuid,uuid,text,uuid,integer) to authenticated;
