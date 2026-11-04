-- ADR-0513: serviço confiável, sem concessão ao navegador.
create function pcm.sso_caminho_anexo_localizacao_servico(p_tipo text,p_vinculo_id uuid,p_usuario_id uuid,p_user_role text) returns text language plpgsql security definer set search_path='' as $$
declare v_claims text;v_sub text;v_caminho text;
begin
 if p_tipo is null or p_tipo not in ('foto','documento') or p_vinculo_id is null or p_usuario_id is null or p_user_role is null or length(p_user_role) not between 1 and 100 then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_claims:=current_setting('request.jwt.claims',true);v_sub:=current_setting('request.jwt.claim.sub',true);
 perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id::text,'user_role',p_user_role)::text,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',p_usuario_id::text,true);
 v_caminho:=pcm.sso_caminho_anexo_localizacao_atualizada(p_tipo,p_vinculo_id);
 perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
 return v_caminho;
end; $$;
revoke all on function pcm.sso_caminho_anexo_localizacao_servico(text,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_caminho_anexo_localizacao_servico(text,uuid,uuid,text) to service_role;
revoke all on function pcm.sso_caminho_anexo_localizacao_atualizada(text,uuid) from public,anon,authenticated,service_role;
