create function pcm.sso_exigir_evidencia_mediada(p_tipo text,p_id uuid) returns void language plpgsql stable security definer set search_path='' as $$
declare v_lote uuid;
begin
 if p_tipo='foto' then select f.lote_id into v_lote from pcm.sso_fotos_levantamento f join pcm.sso_levantamentos l on l.id=f.lote_id and l.cliente_id=f.cliente_id where f.id=p_id;
 elsif p_tipo='documento' then select d.lote_id into v_lote from pcm.sso_documentos_levantamento d join pcm.sso_levantamentos l on l.id=d.lote_id and l.cliente_id=d.cliente_id where d.id=p_id;
 end if;
 if v_lote is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pcm.sso_exigir_mediacao_conferencia(v_lote);
end; $$;
revoke all on function pcm.sso_exigir_evidencia_mediada(text,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_decidir_foto_autorizada(p_request_id uuid,p_foto_id uuid,p_expected_revision integer,p_decisao text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_evidencia_mediada('foto',p_foto_id); return pcm.sso_decidir_foto_levantamento(p_request_id,p_foto_id,p_expected_revision,p_decisao,p_motivo); end; $$;
revoke all on function pcm.sso_decidir_foto_autorizada(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decidir_foto_autorizada(uuid,uuid,integer,text,text) to authenticated;

create function pcm.sso_decisoes_foto_autorizadas(p_foto_id uuid,p_apos integer,p_limite integer) returns table(revisao integer,decisao text,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_evidencia_mediada('foto',p_foto_id); return query select * from pcm.sso_listar_decisoes_foto_levantamento(p_foto_id,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_decisoes_foto_autorizadas(uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decisoes_foto_autorizadas(uuid,integer,integer) to authenticated;

create function pcm.sso_decidir_documento_autorizado(p_request_id uuid,p_documento_id uuid,p_expected_revision integer,p_decisao text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_evidencia_mediada('documento',p_documento_id); return pcm.sso_decidir_documento_levantamento(p_request_id,p_documento_id,p_expected_revision,p_decisao,p_motivo); end; $$;
revoke all on function pcm.sso_decidir_documento_autorizado(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decidir_documento_autorizado(uuid,uuid,integer,text,text) to authenticated;

create function pcm.sso_decisoes_documento_autorizadas(p_documento_id uuid,p_apos integer,p_limite integer) returns table(revisao integer,decisao text,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_evidencia_mediada('documento',p_documento_id); return query select * from pcm.sso_listar_decisoes_documento_levantamento(p_documento_id,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_decisoes_documento_autorizadas(uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decisoes_documento_autorizadas(uuid,integer,integer) to authenticated;
