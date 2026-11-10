-- ADR-0318: somente serviço confiável passa identidade já autenticada.
create function pcm.sso_foto_retorno_servico(p_anexo_id uuid,p_usuario_id uuid,p_user_role text)
returns text language plpgsql security definer set search_path='' as $$
declare v_nome text;v_claims text;v_sub text;
begin
 if p_anexo_id is null or p_usuario_id is null or p_user_role is null or length(p_user_role) not between 1 and 100 then raise exception 'anexo_indisponivel' using errcode='42501'; end if;
 v_claims:=current_setting('request.jwt.claims',true);v_sub:=current_setting('request.jwt.claim.sub',true);
 perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id::text,'user_role',p_user_role)::text,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',p_usuario_id::text,true);
 v_nome:=pcm.sso_foto_retorno_autorizada(p_anexo_id);
 perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);
 perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
 return v_nome;
end; $$;
revoke all on function pcm.sso_foto_retorno_servico(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_foto_retorno_servico(uuid,uuid,text) to service_role;
