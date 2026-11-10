-- ADR-0306: distingue ausência histórica de falha/autorização.
create function comercial.sso_portal_itens_publicos_historico(p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid,p_versao integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_itens jsonb;
begin
  if p_versao is null or p_versao<1 or comercial.sso_portal_origem_operacional_autorizada(p_cliente_id,p_os_id,p_proposta_id) is not true
    then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from comercial.sso_itens_publicos_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if not exists(select 1 from comercial.sso_orcamento_publicacoes p where p.proposta_id=p_proposta_id and p.versao=p_versao)
    then raise exception 'versao_indisponivel' using errcode='42501'; end if;
  select s.itens into v_itens from comercial.sso_itens_publicos_proposta s where s.proposta_id=p_proposta_id and s.versao=p_versao;
  return jsonb_build_object('estruturado',v_itens is not null,'itens',coalesce(v_itens,'[]'::jsonb));
end $$;
revoke all on function comercial.sso_portal_itens_publicos_historico(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
