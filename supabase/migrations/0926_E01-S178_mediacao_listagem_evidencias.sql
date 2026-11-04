create function pcm.sso_fotos_levantamento_autorizadas(p_lote_id uuid,p_chave text,p_apos uuid,p_limite integer) returns table(id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return query select * from pcm.sso_listar_fotos_levantamento(p_lote_id,p_chave,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_fotos_levantamento_autorizadas(uuid,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_fotos_levantamento_autorizadas(uuid,text,uuid,integer) to authenticated;

create function pcm.sso_documentos_levantamento_autorizados(p_lote_id uuid,p_chave text,p_apos uuid,p_limite integer) returns table(id uuid,titulo text,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return query select * from pcm.sso_listar_documentos_levantamento(p_lote_id,p_chave,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_documentos_levantamento_autorizados(uuid,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_documentos_levantamento_autorizados(uuid,text,uuid,integer) to authenticated;

create function pcm.sso_resumo_fotos_autorizado(p_lote_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_resumo_fotos_lote(p_lote_id); end; $$;
revoke all on function pcm.sso_resumo_fotos_autorizado(uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_resumo_fotos_autorizado(uuid) to authenticated;
