create function pcm.sso_exigir_cliente_mediacao(p_cliente_id uuid) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_mediacao_conferencia_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_exigir_cliente_mediacao(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_campos_sistema_autorizado(p_lote_id uuid,p_chave text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_consultar_campos_sistema_staging(p_lote_id,p_chave); end; $$;
revoke all on function pcm.sso_campos_sistema_autorizado(uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_campos_sistema_autorizado(uuid,text) to authenticated;

create function pcm.sso_campos_componente_autorizado(p_lote_id uuid,p_chave text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_consultar_campos_componente_staging(p_lote_id,p_chave); end; $$;
revoke all on function pcm.sso_campos_componente_autorizado(uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_campos_componente_autorizado(uuid,text) to authenticated;

create function pcm.sso_campos_localizacao_autorizado(p_lote_id uuid,p_chave text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_consultar_campos_localizacao_staging(p_lote_id,p_chave); end; $$;
revoke all on function pcm.sso_campos_localizacao_autorizado(uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_campos_localizacao_autorizado(uuid,text) to authenticated;

create function pcm.sso_retrato_sistema_autorizado(p_cliente_id uuid,p_sistema_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_cliente_mediacao(p_cliente_id); return pcm.sso_snapshot_sistema_campos(p_cliente_id,p_sistema_id); end; $$;
revoke all on function pcm.sso_retrato_sistema_autorizado(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_retrato_sistema_autorizado(uuid,uuid) to authenticated;

create function pcm.sso_retrato_componente_autorizado(p_cliente_id uuid,p_entidade_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_cliente_mediacao(p_cliente_id); return pcm.sso_snapshot_componente_campos(p_cliente_id,p_entidade_id); end; $$;
revoke all on function pcm.sso_retrato_componente_autorizado(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_retrato_componente_autorizado(uuid,uuid) to authenticated;

create function pcm.sso_retrato_localizacao_autorizado(p_cliente_id uuid,p_tipo text,p_entidade_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_cliente_mediacao(p_cliente_id); return pcm.sso_snapshot_localizacao_completo(p_cliente_id,p_tipo,p_entidade_id); end; $$;
revoke all on function pcm.sso_retrato_localizacao_autorizado(uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_retrato_localizacao_autorizado(uuid,text,uuid) to authenticated;
