create function pcm.sso_marcar_foto_autorizada(p_request_id uuid,p_foto_id uuid,p_expected_revision integer,p_estado text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_evidencia_mediada('foto',p_foto_id); return pcm.sso_marcar_adequacao_foto(p_request_id,p_foto_id,p_expected_revision,p_estado,p_motivo); end; $$;
revoke all on function pcm.sso_marcar_foto_autorizada(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_marcar_foto_autorizada(uuid,uuid,integer,text,text) to authenticated;

create function pcm.sso_adequacao_foto_autorizada(p_foto_id uuid,p_apos integer,p_limite integer) returns table(revisao integer,estado text,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_evidencia_mediada('foto',p_foto_id); return query select * from pcm.sso_listar_adequacao_foto(p_foto_id,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_adequacao_foto_autorizada(uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_adequacao_foto_autorizada(uuid,integer,integer) to authenticated;

create function pcm.sso_marcar_documento_autorizado(p_request_id uuid,p_documento_id uuid,p_expected_revision integer,p_estado text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_evidencia_mediada('documento',p_documento_id); return pcm.sso_marcar_adequacao_documento(p_request_id,p_documento_id,p_expected_revision,p_estado,p_motivo); end; $$;
revoke all on function pcm.sso_marcar_documento_autorizado(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_marcar_documento_autorizado(uuid,uuid,integer,text,text) to authenticated;

create function pcm.sso_adequacao_documento_autorizada(p_documento_id uuid,p_apos integer,p_limite integer) returns table(revisao integer,estado text,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_evidencia_mediada('documento',p_documento_id); return query select * from pcm.sso_listar_adequacao_documento(p_documento_id,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_adequacao_documento_autorizada(uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_adequacao_documento_autorizada(uuid,integer,integer) to authenticated;

create function pcm.sso_revisar_pertinencia_autorizada(p_request_id uuid,p_tipo text,p_anexo_id uuid,p_expected_revision integer,p_edicao_revision integer,p_decisao text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_evidencia_mediada(p_tipo,p_anexo_id); return pcm.sso_revisar_pertinencia_evidencia(p_request_id,p_tipo,p_anexo_id,p_expected_revision,p_edicao_revision,p_decisao,p_motivo); end; $$;
revoke all on function pcm.sso_revisar_pertinencia_autorizada(uuid,text,uuid,integer,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_revisar_pertinencia_autorizada(uuid,text,uuid,integer,integer,text,text) to authenticated;

create function pcm.sso_pertinencia_autorizada(p_tipo text,p_anexo_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_evidencia_mediada(p_tipo,p_anexo_id); return pcm.sso_consultar_pertinencia_evidencia(p_tipo,p_anexo_id); end; $$;
revoke all on function pcm.sso_pertinencia_autorizada(text,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_pertinencia_autorizada(text,uuid) to authenticated;

create function pcm.sso_historico_pertinencia_autorizado(p_tipo text,p_anexo_id uuid,p_apos integer,p_limite integer) returns table(revisao integer,edicao_revision integer,decisao text,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_evidencia_mediada(p_tipo,p_anexo_id); return query select * from pcm.sso_listar_pertinencia_evidencia(p_tipo,p_anexo_id,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_historico_pertinencia_autorizado(text,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_pertinencia_autorizado(text,uuid,integer,integer) to authenticated;
