-- ADR-0718: listagem autorizada e caminho exclusivo do serviço.
create function pcm.sso_listar_fotos_staging_ativo_mediado(p_tipo text,p_entidade_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select f.id,f.criado_em from pcm.sso_listar_fotos_staging_ativo(p_tipo,p_entidade_id,p_apos,p_limite) f;
end; $$;
revoke all on function pcm.sso_listar_fotos_staging_ativo_mediado(text,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fotos_staging_ativo_mediado(text,uuid,uuid,integer) to authenticated;

create function pcm.sso_caminho_foto_staging_ativo_servico(p_vinculo_id uuid,p_usuario_id uuid,p_user_role text)
returns text language plpgsql security definer set search_path='' as $$
declare v_claims text; v_sub text; v_caminho text;
begin
  if p_vinculo_id is null or p_usuario_id is null or p_user_role is null or length(p_user_role) not between 1 and 100 then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_claims:=current_setting('request.jwt.claims',true); v_sub:=current_setting('request.jwt.claim.sub',true);
  perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id::text,'user_role',p_user_role)::text,true);
  perform pg_catalog.set_config('request.jwt.claim.sub',p_usuario_id::text,true);
  v_caminho:=pcm.sso_caminho_foto_staging_ativo(p_vinculo_id);
  perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);
  perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
  return v_caminho;
end; $$;
revoke all on function pcm.sso_caminho_foto_staging_ativo_servico(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_caminho_foto_staging_ativo_servico(uuid,uuid,text) to service_role;
