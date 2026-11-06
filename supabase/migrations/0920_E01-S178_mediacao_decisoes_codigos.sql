create function pcm.sso_exigir_gerencia_lote_mediacao(p_lote_id uuid) returns void language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
 if not coalesce((select habilitado from pcm.sso_mediacao_conferencia_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_lote_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id;
 if not found or v_cliente is null or config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_exigir_gerencia_lote_mediacao(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_decisao_linha_autorizada(p_lote_id uuid,p_chave text) returns table(decisao text,revisao integer,motivo text,tipo text,entidade_id uuid,ator_id uuid,ocorrido_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return query select * from pcm.sso_consultar_decisao_linha_levantamento(p_lote_id,p_chave); end; $$;
revoke all on function pcm.sso_decisao_linha_autorizada(uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decisao_linha_autorizada(uuid,text) to authenticated;

create function pcm.sso_reabrir_rejeicao_autorizada(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_reabrir_rejeicao_linha(p_request_id,p_lote_id,p_expected_revision,p_chave,p_motivo); end; $$;
revoke all on function pcm.sso_reabrir_rejeicao_autorizada(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reabrir_rejeicao_autorizada(uuid,uuid,integer,text,text) to authenticated;

create function pcm.sso_codigo_staging_autorizado(p_lote_id uuid,p_chave text) returns table(codigo text,revisao integer) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_gerencia_lote_mediacao(p_lote_id); return query select * from pcm.sso_consultar_codigo_staging(p_lote_id,p_chave); end; $$;
revoke all on function pcm.sso_codigo_staging_autorizado(uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_codigo_staging_autorizado(uuid,text) to authenticated;

create function pcm.sso_salvar_codigo_autorizado(p_request_id uuid,p_lote_id uuid,p_chave text,p_lote_revisao integer,p_revisao integer,p_codigo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_gerencia_lote_mediacao(p_lote_id); return pcm.sso_salvar_codigo_staging(p_request_id,p_lote_id,p_chave,p_lote_revisao,p_revisao,p_codigo); end; $$;
revoke all on function pcm.sso_salvar_codigo_autorizado(uuid,uuid,text,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_salvar_codigo_autorizado(uuid,uuid,text,integer,integer,text) to authenticated;

create function pcm.sso_codigo_aprovacao_autorizado(p_lote_id uuid,p_chave text) returns table(codigo text,revisao integer) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return query select * from pcm.sso_codigo_staging_para_aprovacao(p_lote_id,p_chave); end; $$;
revoke all on function pcm.sso_codigo_aprovacao_autorizado(uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_codigo_aprovacao_autorizado(uuid,text) to authenticated;

create function pcm.sso_reserva_codigo_autorizada(p_cliente_id uuid,p_lote_id uuid,p_chave text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_consultar_reserva_codigo_linha(p_cliente_id,p_lote_id,p_chave); end; $$;
revoke all on function pcm.sso_reserva_codigo_autorizada(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reserva_codigo_autorizada(uuid,uuid,text) to authenticated;

create function pcm.sso_corrigir_codigo_autorizado(p_request_id uuid,p_request_edicao uuid,p_request_codigo uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_antes jsonb,p_codigo_revision integer,p_codigo text,p_motivo text,p_confirmado boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_corrigir_codigo_staging(p_request_id,p_request_edicao,p_request_codigo,p_lote_id,p_expected_revision,p_chave,p_antes,p_codigo_revision,p_codigo,p_motivo,p_confirmado); end; $$;
revoke all on function pcm.sso_corrigir_codigo_autorizado(uuid,uuid,uuid,uuid,integer,text,jsonb,integer,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_corrigir_codigo_autorizado(uuid,uuid,uuid,uuid,integer,text,jsonb,integer,text,text,boolean) to authenticated;
