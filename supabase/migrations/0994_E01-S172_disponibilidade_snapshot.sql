-- ADR-0796: declarações parciais no mesmo snapshot, sem afirmar disponibilidade real.
create function pcm.sso_mediar_snapshot_capacidade_v4(p_cliente_id uuid,p_semana_inicio date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_base jsonb;v_lista jsonb;v_quantidade integer;
begin
 v_base:=pcm.sso_mediar_snapshot_capacidade_v3(p_cliente_id,p_semana_inicio);
 select count(*),coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) into v_quantidade,v_lista from (
  select id,funcionario_id,semana_inicio,revisao,destinados_minutos,reservas_minutos,ausencias_minutos
  from pcm.capacidade_disponibilidades where cliente_id=p_cliente_id and semana_inicio=p_semana_inicio order by id limit 100
 ) d;
 return v_base||jsonb_build_object('disponibilidades',v_lista,'limiteDisponibilidadesAtingido',v_quantidade=100);
end; $$;
revoke all on function pcm.sso_mediar_snapshot_capacidade_v4(uuid,date) from public,anon,service_role;
grant execute on function pcm.sso_mediar_snapshot_capacidade_v4(uuid,date) to authenticated;
