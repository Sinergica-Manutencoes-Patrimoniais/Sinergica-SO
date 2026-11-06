-- ADR-1506: exibir estado atual sem alterar o recibo histórico nem a API antiga.
create function pcm.sso_consultar_resolucao_impacto_v2(
 p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_rascunho_id uuid,p_preparada_id uuid,
 p_expected_plano integer,p_expected_decisao integer,p_tipo text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_base jsonb;v_obsoleta boolean;
begin
 v_base:=pcm.sso_consultar_resolucao_impacto(p_ator_id,p_cliente_id,p_plano_id,p_rascunho_id,p_preparada_id,p_expected_plano,p_expected_decisao,p_tipo);
 v_obsoleta:=(v_base->>'resolvida')::boolean is true
  and pcm.sso_escopo_impacto_retirado(p_cliente_id,p_plano_id,p_rascunho_id,p_preparada_id,p_tipo) is distinct from true;
 if v_obsoleta then
  return v_base||jsonb_build_object('resolvida',false,'motivo',null,'resolucaoObsoleta',true);
 end if;
 return v_base||jsonb_build_object('resolucaoObsoleta',false);
end; $$;
revoke all on function pcm.sso_consultar_resolucao_impacto_v2(uuid,uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_resolucao_impacto_v2(uuid,uuid,uuid,uuid,uuid,integer,integer,text) to authenticated;
