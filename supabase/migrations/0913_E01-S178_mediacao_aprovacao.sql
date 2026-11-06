create function pcm.sso_exigir_mediacao_conferencia(p_lote_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_cliente_id uuid;
begin
 if not coalesce((select habilitado from pcm.sso_mediacao_conferencia_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_lote_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 select cliente_id into v_cliente_id from pcm.sso_levantamentos where id=p_lote_id;
 if not found or v_cliente_id is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_exigir_mediacao_conferencia(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_concluir_conferencia_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform pcm.sso_exigir_mediacao_conferencia(p_lote_id);
 return pcm.sso_concluir_conferencia_lote(p_request_id,p_lote_id,p_expected_revision);
end; $$;
revoke all on function pcm.sso_concluir_conferencia_autorizado(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_concluir_conferencia_autorizado(uuid,uuid,integer) to authenticated;

create function pcm.sso_reabrir_conferencia_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform pcm.sso_exigir_mediacao_conferencia(p_lote_id);
 return pcm.sso_reabrir_conferencia_lote(p_request_id,p_lote_id,p_expected_revision,p_motivo);
end; $$;
revoke all on function pcm.sso_reabrir_conferencia_autorizado(uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reabrir_conferencia_autorizado(uuid,uuid,integer,text) to authenticated;

create function pcm.sso_retrato_aprovacao_autorizado(p_lote_id uuid,p_chave text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform pcm.sso_exigir_mediacao_conferencia(p_lote_id);
 return pcm.sso_retrato_aprovacao_parcial(p_lote_id,p_chave);
end; $$;
revoke all on function pcm.sso_retrato_aprovacao_autorizado(uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_retrato_aprovacao_autorizado(uuid,text) to authenticated;

create function pcm.sso_aprovar_linhas_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_itens jsonb,p_motivo text,p_confirmado boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform pcm.sso_exigir_mediacao_conferencia(p_lote_id);
 return pcm.sso_aprovar_linhas_parcialmente(p_request_id,p_lote_id,p_expected_revision,p_itens,p_motivo,p_confirmado);
end; $$;
revoke all on function pcm.sso_aprovar_linhas_autorizado(uuid,uuid,integer,jsonb,text,boolean) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_aprovar_linhas_autorizado(uuid,uuid,integer,jsonb,text,boolean) to authenticated;
