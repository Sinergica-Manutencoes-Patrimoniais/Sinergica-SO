-- ADR-0329: resolução somente por serviço, sem concessão até revisão integrada.
create function financeiro.sso_resolver_anexo_faturavel_servico(p_usuario_id uuid,p_anexo_id uuid,p_papel text)
returns text language plpgsql security definer set search_path='' as $$
declare v_claims text; v_caminho text;
begin
  if auth.role() is distinct from 'service_role' or p_usuario_id is null or p_anexo_id is null or p_papel is null or length(p_papel)>100 then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_claims:=current_setting('request.jwt.claims',true);
  perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id::text,'role','authenticated','user_role',p_papel)::text,true);
  v_caminho:=financeiro.sso_anexo_faturavel_autorizado(p_anexo_id);
  perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);
  return v_caminho;
end $$;
revoke all on function financeiro.sso_resolver_anexo_faturavel_servico(uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function financeiro.sso_anexo_faturavel_autorizado(uuid) from public,anon,authenticated,service_role;
