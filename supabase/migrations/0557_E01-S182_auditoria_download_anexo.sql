-- ADR-0331: evento sem caminho; função chamada apenas pelo serviço.
create function financeiro.sso_auditar_anexo_faturavel_servico(p_usuario_id uuid,p_papel text,p_anexo_id uuid,p_request_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_claims text; v_item uuid; v_cliente uuid; v_caminho text;
begin
  if auth.role() is distinct from 'service_role' or p_usuario_id is null or p_anexo_id is null or p_request_id is null or p_papel is null or length(p_papel)>100
    then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_claims:=current_setting('request.jwt.claims',true);
  perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id::text,'role','authenticated','user_role',p_papel)::text,true);
  v_caminho:=financeiro.sso_anexo_faturavel_autorizado(p_anexo_id);
  select i.id,i.cliente_id into v_item,v_cliente from financeiro.sso_anexos_faturaveis a join financeiro.itens_faturaveis i on i.id=a.item_id where a.id=p_anexo_id;
  if v_caminho is null or v_item is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_usuario_id,'faturavel.comprovante_acessado','itens_faturaveis',v_item,
    jsonb_build_object('requestId',p_request_id,'clienteId',v_cliente,'anexoId',p_anexo_id));
  perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);
  return true;
end $$;
revoke all on function financeiro.sso_auditar_anexo_faturavel_servico(uuid,text,uuid,uuid) from public,anon,authenticated,service_role;
