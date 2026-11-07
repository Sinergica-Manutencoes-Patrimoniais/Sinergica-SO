-- ADR-0791: listas limitadas, mesmo snapshot de instrução, sem afirmar cobertura.
create function pcm.sso_mediar_snapshot_capacidade(p_cliente_id uuid,p_semana_inicio date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_os jsonb;v_ocorrencias jsonb;v_total_os integer;v_total_ocorrencias integer;
begin
 select count(*),coalesce(jsonb_agg(to_jsonb(f) order by f.vinculo_id),'[]'::jsonb) into v_total_os,v_os
   from pcm.sso_mediar_fontes_esforco_visita(p_cliente_id,p_semana_inicio,null,100) f;
 select count(*),coalesce(jsonb_agg(to_jsonb(o) order by o.tipo,o.ocorrencia_id),'[]'::jsonb) into v_total_ocorrencias,v_ocorrencias
   from pcm.sso_mediar_ocorrencias_sem_os(p_cliente_id,p_semana_inicio,null,null,100) o;
 return jsonb_build_object('clienteId',p_cliente_id,'semanaInicio',p_semana_inicio,'fontesVisita',v_os,'ocorrenciasSemOs',v_ocorrencias,
   'limiteFontesAtingido',v_total_os=100,'limiteOcorrenciasAtingido',v_total_ocorrencias=100,'completude','desconhecida');
end; $$;
revoke all on function pcm.sso_mediar_snapshot_capacidade(uuid,date) from public,anon,service_role;
grant execute on function pcm.sso_mediar_snapshot_capacidade(uuid,date) to authenticated;
