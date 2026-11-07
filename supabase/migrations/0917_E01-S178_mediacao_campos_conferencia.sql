create function pcm.sso_editar_sistema_staging_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_campos jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_editar_campos_sistema_staging(p_request_id,p_lote_id,p_expected_revision,p_chave,p_campos,p_motivo); end; $$;
revoke all on function pcm.sso_editar_sistema_staging_autorizado(uuid,uuid,integer,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_editar_sistema_staging_autorizado(uuid,uuid,integer,text,jsonb,text) to authenticated;

create function pcm.sso_conferir_sistema_staging_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_retrato jsonb,p_confirma boolean,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_conferir_campos_sistema_staging(p_request_id,p_lote_id,p_expected_revision,p_chave,p_retrato,p_confirma,p_motivo); end; $$;
revoke all on function pcm.sso_conferir_sistema_staging_autorizado(uuid,uuid,integer,text,jsonb,boolean,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_conferir_sistema_staging_autorizado(uuid,uuid,integer,text,jsonb,boolean,text) to authenticated;

create function pcm.sso_editar_componente_staging_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_campos jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_editar_campos_componente_staging(p_request_id,p_lote_id,p_expected_revision,p_chave,p_campos,p_motivo); end; $$;
revoke all on function pcm.sso_editar_componente_staging_autorizado(uuid,uuid,integer,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_editar_componente_staging_autorizado(uuid,uuid,integer,text,jsonb,text) to authenticated;

create function pcm.sso_conferir_componente_staging_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_retrato jsonb,p_confirma boolean,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_conferir_campos_componente_staging(p_request_id,p_lote_id,p_expected_revision,p_chave,p_retrato,p_confirma,p_motivo); end; $$;
revoke all on function pcm.sso_conferir_componente_staging_autorizado(uuid,uuid,integer,text,jsonb,boolean,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_conferir_componente_staging_autorizado(uuid,uuid,integer,text,jsonb,boolean,text) to authenticated;

create function pcm.sso_editar_localizacao_staging_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_campos jsonb,p_motivo text,p_confirmado boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_editar_campos_localizacao_staging(p_request_id,p_lote_id,p_expected_revision,p_chave,p_campos,p_motivo,p_confirmado); end; $$;
revoke all on function pcm.sso_editar_localizacao_staging_autorizado(uuid,uuid,integer,text,jsonb,text,boolean) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_editar_localizacao_staging_autorizado(uuid,uuid,integer,text,jsonb,text,boolean) to authenticated;

create function pcm.sso_conferir_localizacao_staging_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_revisao_campos integer,p_campos jsonb,p_motivo text,p_confirmado boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_conferir_campos_localizacao(p_request_id,p_lote_id,p_expected_revision,p_chave,p_revisao_campos,p_campos,p_motivo,p_confirmado); end; $$;
revoke all on function pcm.sso_conferir_localizacao_staging_autorizado(uuid,uuid,integer,text,integer,jsonb,text,boolean) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_conferir_localizacao_staging_autorizado(uuid,uuid,integer,text,integer,jsonb,text,boolean) to authenticated;

create function pcm.sso_retrato_conferencia_localizacao_autorizado(p_lote_id uuid,p_chave text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_retrato_campos_localizacao_para_conferencia(p_lote_id,p_chave); end; $$;
revoke all on function pcm.sso_retrato_conferencia_localizacao_autorizado(uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_retrato_conferencia_localizacao_autorizado(uuid,text) to authenticated;
