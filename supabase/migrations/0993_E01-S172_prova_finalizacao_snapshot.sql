-- ADR-0795: evidência de finalização individual, nunca de ocorrência completa.
create function pcm.sso_mediar_snapshot_capacidade_v3(p_cliente_id uuid,p_semana_inicio date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_base jsonb;v_lista jsonb;v_acesso boolean;
begin
 v_base:=pcm.sso_mediar_snapshot_capacidade_v2(p_cliente_id,p_semana_inicio);
 v_acesso:=coalesce((select habilitado from pcm.sso_mediacao_finalizacao_os_gate where id),false)
  and coalesce((select habilitado from pcm.sso_finalizar_os_validada_gate where id),false)
  and config.sso_autorizar_acao('execucao.validar',p_cliente_id) is true;
 select coalesce(jsonb_agg(f.item||jsonb_build_object('prova_finalizacao_pcm',
   case when not v_acesso then 'indisponivel'
    when f.item->>'os_status'='finalizado' and exists(
      select 1 from pcm.sso_finalizacoes_os_validadas d
      join pcm.retorno_os_preparado r on r.id=d.retorno_id and r.os_id=d.os_id and r.cliente_id=p_cliente_id
      where d.os_id=(f.item->>'os_id')::uuid and d.resultado->>'osId'=f.item->>'os_id' and d.resultado->>'status'='finalizado'
    ) then 'finalizacao_pcm_registrada'
    else 'nao_registrada' end) order by f.ord),'[]'::jsonb)
 into v_lista from jsonb_array_elements(v_base->'fontesVisita') with ordinality f(item,ord);
 return jsonb_set(v_base,'{fontesVisita}',v_lista,false);
end; $$;
revoke all on function pcm.sso_mediar_snapshot_capacidade_v3(uuid,date) from public,anon,service_role;
grant execute on function pcm.sso_mediar_snapshot_capacidade_v3(uuid,date) to authenticated;
