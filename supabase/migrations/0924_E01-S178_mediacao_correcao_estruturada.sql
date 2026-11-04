create function pcm.sso_editar_atributos_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_antes jsonb,p_alteracoes jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_editar_atributos_linha_staging(p_request_id,p_lote_id,p_expected_revision,p_chave,p_antes,p_alteracoes,p_motivo); end; $$;
revoke all on function pcm.sso_editar_atributos_autorizado(uuid,uuid,integer,text,jsonb,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_editar_atributos_autorizado(uuid,uuid,integer,text,jsonb,jsonb,text) to authenticated;

create function pcm.sso_corrigir_parcial_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_antes jsonb,p_alteracoes jsonb,p_motivo text,p_confirmado boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_corrigir_linha_apos_parcial(p_request_id,p_lote_id,p_expected_revision,p_chave,p_antes,p_alteracoes,p_motivo,p_confirmado); end; $$;
revoke all on function pcm.sso_corrigir_parcial_autorizado(uuid,uuid,integer,text,jsonb,jsonb,text,boolean) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_corrigir_parcial_autorizado(uuid,uuid,integer,text,jsonb,jsonb,text,boolean) to authenticated;

create function pcm.sso_recuperar_atualizacao_autorizada(p_lote_id uuid,p_request_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_recuperar_atualizacao_lote(p_lote_id,p_request_id); end; $$;
revoke all on function pcm.sso_recuperar_atualizacao_autorizada(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recuperar_atualizacao_autorizada(uuid,uuid) to authenticated;
