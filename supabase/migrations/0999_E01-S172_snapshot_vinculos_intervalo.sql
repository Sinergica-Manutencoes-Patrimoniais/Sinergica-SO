-- ADR-0802: vínculos declarados da revisão atual no snapshot parcial.
create function pcm.sso_mediar_snapshot_capacidade_v5(p_cliente_id uuid,p_semana_inicio date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_base jsonb; v_vinculos jsonb; v_contagem integer;
begin
 v_base:=pcm.sso_mediar_snapshot_capacidade_v4(p_cliente_id,p_semana_inicio);
 if not coalesce((select habilitado from pcm.capacidade_vinculo_intervalo_gate where id),false) then
   raise exception 'vinculo_intervalo_bloqueado' using errcode='55000'; end if;
 select count(*),coalesce(jsonb_agg(to_jsonb(v) order by v.disponibilidade_id,v.intervalo_id),'[]'::jsonb) into v_contagem,v_vinculos from (
   select d.id as disponibilidade_id,i.id as intervalo_id,i.tipo,e.revisao_vinculo,e.incluido
   from jsonb_to_recordset(v_base->'disponibilidades') as d(id uuid,revisao integer)
   join pcm.capacidade_intervalos_declarados i on i.disponibilidade_id=d.id
   join lateral (
     select x.revisao_vinculo,x.incluido from pcm.capacidade_vinculo_intervalo_eventos x
     where x.cliente_id=p_cliente_id and x.disponibilidade_id=d.id and x.intervalo_id=i.id and x.revisao_disponibilidade=d.revisao
     order by x.revisao_vinculo desc limit 1
   ) e on true
   order by d.id,i.id limit 100
 ) v;
 return v_base||jsonb_build_object('vinculosIntervalo',v_vinculos,'limiteVinculosIntervaloAtingido',v_contagem=100);
end; $$;
revoke all on function pcm.sso_mediar_snapshot_capacidade_v5(uuid,date) from public,anon,service_role;
grant execute on function pcm.sso_mediar_snapshot_capacidade_v5(uuid,date) to authenticated;
