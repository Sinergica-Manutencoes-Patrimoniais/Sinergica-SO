create function pcm.sso_atualizar_grupo_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_grupo_id uuid,p_grupo_revision integer,p_local_id uuid,p_caracteristicas jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_atualizar_grupo_levantamento(p_request_id,p_lote_id,p_expected_revision,p_chave,p_grupo_id,p_grupo_revision,p_local_id,p_caracteristicas); end; $$;
revoke all on function pcm.sso_atualizar_grupo_autorizado(uuid,uuid,integer,text,uuid,integer,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_atualizar_grupo_autorizado(uuid,uuid,integer,text,uuid,integer,uuid,jsonb) to authenticated;

create function pcm.sso_atualizar_grupo_motivado_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_grupo_id uuid,p_grupo_revision integer,p_local_id uuid,p_caracteristicas jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_atualizar_grupo_levantamento_motivado(p_request_id,p_lote_id,p_expected_revision,p_chave,p_grupo_id,p_grupo_revision,p_local_id,p_caracteristicas,p_motivo); end; $$;
revoke all on function pcm.sso_atualizar_grupo_motivado_autorizado(uuid,uuid,integer,text,uuid,integer,uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_atualizar_grupo_motivado_autorizado(uuid,uuid,integer,text,uuid,integer,uuid,jsonb,text) to authenticated;
