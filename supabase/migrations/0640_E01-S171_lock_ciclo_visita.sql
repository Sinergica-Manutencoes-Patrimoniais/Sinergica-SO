-- ADR-0414: ciclo da Visita, sem liberar serialização nem despacho.
alter function pcm.sso_editar_visita(uuid,integer,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid,integer) rename to sso_editar_visita_base_0640;
revoke all on function pcm.sso_editar_visita_base_0640(uuid,integer,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_editar_visita(p_request_id uuid,p_expected_revision integer,p_visita_id uuid,p_area_id uuid,p_local_id uuid,p_inicio_em timestamptz,p_fim_em timestamptz,p_fuso text,p_responsavel_id uuid,p_deslocamento_minutos integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform pcm.sso_lock_escritor_composicao(p_request_id,p_visita_id);
  return pcm.sso_editar_visita_base_0640(p_request_id,p_expected_revision,p_visita_id,p_area_id,p_local_id,p_inicio_em,p_fim_em,p_fuso,p_responsavel_id,p_deslocamento_minutos);
end $$;
revoke all on function pcm.sso_editar_visita(uuid,integer,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid,integer) from public,anon;
grant execute on function pcm.sso_editar_visita(uuid,integer,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid,integer) to authenticated;

alter function pcm.sso_planejar_visita(uuid,integer,uuid) rename to sso_planejar_visita_base_0640;
revoke all on function pcm.sso_planejar_visita_base_0640(uuid,integer,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_planejar_visita(p_request_id uuid,p_expected_revision integer,p_visita_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform pcm.sso_lock_escritor_composicao(p_request_id,p_visita_id);
  return pcm.sso_planejar_visita_base_0640(p_request_id,p_expected_revision,p_visita_id);
end $$;
revoke all on function pcm.sso_planejar_visita(uuid,integer,uuid) from public,anon;
grant execute on function pcm.sso_planejar_visita(uuid,integer,uuid) to authenticated;

alter function pcm.sso_confirmar_visita(uuid,integer,uuid) rename to sso_confirmar_visita_base_0640;
revoke all on function pcm.sso_confirmar_visita_base_0640(uuid,integer,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_confirmar_visita(p_request_id uuid,p_expected_revision integer,p_visita_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform pcm.sso_lock_escritor_composicao(p_request_id,p_visita_id);
  return pcm.sso_confirmar_visita_base_0640(p_request_id,p_expected_revision,p_visita_id);
end $$;
revoke all on function pcm.sso_confirmar_visita(uuid,integer,uuid) from public,anon;
grant execute on function pcm.sso_confirmar_visita(uuid,integer,uuid) to authenticated;
