-- ADR-1226: versão atual e snapshot público estruturado obrigatórios.
create function comercial.sso_portal_itens_atuais_mediados(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid,p_versao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
  if p_versao is null or p_versao<1 then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform comercial.sso_exigir_historico_proposta_portal(p_ator_id,p_cliente_id,p_os_id,p_proposta_id);
  perform 1 from comercial.propostas where id=p_proposta_id and versao_atual=p_versao and deleted_at is null for share;
  if not found then raise exception 'versao_indisponivel' using errcode='42501'; end if;
  v_resultado:=comercial.sso_portal_itens_historicos_mediados(p_ator_id,p_cliente_id,p_os_id,p_proposta_id,p_versao);
  if v_resultado->'estruturado' is distinct from 'true'::jsonb then raise exception 'itens_indisponiveis' using errcode='42501'; end if;
  return v_resultado->'itens';
end; $$;
revoke all on function comercial.sso_portal_itens_atuais_mediados(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_portal_itens_atuais_mediados(uuid,uuid,uuid,uuid,integer) to authenticated;
