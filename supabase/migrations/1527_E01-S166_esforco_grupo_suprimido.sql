-- ADR-1381: consulta direta não trata Visita suprimida como demanda.
alter function pcm.sso_prever_esforco_grupo(uuid,uuid) rename to sso_prever_esforco_grupo_base_1527;
revoke all on function pcm.sso_prever_esforco_grupo_base_1527(uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_prever_esforco_grupo(p_cliente_id uuid,p_ocorrencia_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 v_resultado:=pcm.sso_prever_esforco_grupo_base_1527(p_cliente_id,p_ocorrencia_id);
 if exists(select 1 from pcm.sso_ocorrencias_grupo g
   join pcm.ocorrencias_visita_preparadas o on o.id=g.visita_preparada_id and o.plano_id=g.plano_id
   join pcm.sso_visitas_suprimidas_feriado s on s.visita_id=o.visita_id and s.cliente_id=g.cliente_id
   where g.id=p_ocorrencia_id and g.cliente_id=p_cliente_id) then raise exception 'ocorrencia_grupo_suprimida' using errcode='23514'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_prever_esforco_grupo(uuid,uuid) from public,anon,authenticated,service_role;
