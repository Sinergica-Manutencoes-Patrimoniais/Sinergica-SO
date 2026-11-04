create function pcm.sso_editar_linha_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_antes jsonb,p_mudar_observacao boolean,p_observacao text,p_mudar_quantidade boolean,p_quantidade text,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform pcm.sso_exigir_mediacao_conferencia(p_lote_id);
 return pcm.sso_editar_linha_levantamento(p_request_id,p_lote_id,p_expected_revision,p_chave,p_antes,p_mudar_observacao,p_observacao,p_mudar_quantidade,p_quantidade,p_motivo);
end; $$;
revoke all on function pcm.sso_editar_linha_autorizado(uuid,uuid,integer,text,jsonb,boolean,text,boolean,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_editar_linha_autorizado(uuid,uuid,integer,text,jsonb,boolean,text,boolean,text,text) to authenticated;

create function pcm.sso_rejeitar_linha_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform pcm.sso_exigir_mediacao_conferencia(p_lote_id);
 return pcm.sso_rejeitar_linha_levantamento(p_request_id,p_lote_id,p_expected_revision,p_chave,p_motivo);
end; $$;
revoke all on function pcm.sso_rejeitar_linha_autorizado(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_rejeitar_linha_autorizado(uuid,uuid,integer,text,text) to authenticated;
