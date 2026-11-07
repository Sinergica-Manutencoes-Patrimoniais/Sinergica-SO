-- ADR-0800: preparo isolado. Não altera policies, grants existentes ou gates.
-- Não conectar a políticas até validação, revisão e rollout coordenado.
create function pcm.sso_s180_dispatch_storage_experimental(p_bucket text, p_nome text, p_owner text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_owner is distinct from auth.uid()::text then return false; end if;
  case p_bucket
    when 'sso-despesas-visita' then return pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_comprovante(text)','execute') and pcm.sso_autorizar_upload_comprovante(p_nome);
    when 'sso-grupos-fotos' then return pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_foto_grupo(text)','execute') and pcm.sso_autorizar_upload_foto_grupo(p_nome);
    when 'sso-material-evidencias' then return pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_evidencia_material(text)','execute') and pcm.sso_autorizar_upload_evidencia_material(p_nome);
    when 'sso-levantamento-fotos' then return pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_foto_levantamento(text)','execute') and pcm.sso_autorizar_upload_foto_levantamento(p_nome);
    when 'sso-levantamento-documentos' then return pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_documento_levantamento(text)','execute') and pcm.sso_autorizar_upload_documento_levantamento(p_nome);
    when 'sso-retorno-evidencias' then return pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_evidencia_resposta(text)','execute') and pcm.sso_autorizar_upload_evidencia_resposta(p_nome);
    else return false;
  end case;
end $$;

create function pcm.sso_s180_guard_storage_experimental(p_bucket text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_bucket = 'sso-despesas-visita' or (
    pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_foto_grupo(text)','execute') and
    pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_evidencia_material(text)','execute') and
    pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_foto_levantamento(text)','execute') and
    pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_documento_levantamento(text)','execute') and
    pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_evidencia_resposta(text)','execute') and
    pg_catalog.has_function_privilege('authenticated','pcm.sso_autorizar_upload_comprovante(text)','execute'));
$$;

revoke all on function pcm.sso_s180_dispatch_storage_experimental(text,text,text) from public, anon, authenticated, service_role;
revoke all on function pcm.sso_s180_guard_storage_experimental(text) from public, anon, authenticated, service_role;
comment on function pcm.sso_s180_dispatch_storage_experimental(text,text,text) is 'Experimental e inacessível; ADR-0800 exige rollout coordenado e validação.';
comment on function pcm.sso_s180_guard_storage_experimental(text) is 'Experimental e inacessível; não instala política nem habilita upload.';
