create function pcm.sso_incorporar_localizacao_autorizada(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_incorporar_localizacao_levantamento(p_request_id,p_lote_id,p_expected_revision,p_chave); end; $$;
revoke all on function pcm.sso_incorporar_localizacao_autorizada(uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_incorporar_localizacao_autorizada(uuid,uuid,integer,text) to authenticated;

create function pcm.sso_snapshot_localizacao_autorizado(p_cliente_id uuid,p_tipo text,p_entidade_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_cliente_mediacao(p_cliente_id); return pcm.sso_snapshot_localizacao_levantamento(p_cliente_id,p_tipo,p_entidade_id); end; $$;
revoke all on function pcm.sso_snapshot_localizacao_autorizado(uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_snapshot_localizacao_autorizado(uuid,text,uuid) to authenticated;

create function pcm.sso_retrato_grupo_autorizado(p_cliente_id uuid,p_grupo_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_cliente_mediacao(p_cliente_id); return pcm.sso_consultar_grupo_para_levantamento(p_cliente_id,p_grupo_id); end; $$;
revoke all on function pcm.sso_retrato_grupo_autorizado(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_retrato_grupo_autorizado(uuid,uuid) to authenticated;
