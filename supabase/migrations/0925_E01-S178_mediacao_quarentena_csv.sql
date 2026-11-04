create function pcm.sso_exigir_cliente_quarentena(p_cliente_id uuid) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_mediacao_conferencia_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_exigir_cliente_quarentena(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_exigir_quarentena_mediada(p_id uuid) returns void language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
 select cliente_id into v_cliente from pcm.sso_quarentena_csv_lotes where id=p_id;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pcm.sso_exigir_cliente_quarentena(v_cliente);
end; $$;
revoke all on function pcm.sso_exigir_quarentena_mediada(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_receber_quarentena_autorizada(p_request_id uuid,p_cliente_id uuid,p_chave_origem text,p_linhas jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_cliente_quarentena(p_cliente_id); return pcm.sso_receber_quarentena_csv(p_request_id,p_cliente_id,p_chave_origem,p_linhas); end; $$;
revoke all on function pcm.sso_receber_quarentena_autorizada(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_receber_quarentena_autorizada(uuid,uuid,text,jsonb) to authenticated;

create function pcm.sso_listar_quarentena_autorizada(p_cliente_id uuid,p_apos uuid,p_limite integer) returns table(id uuid,chave_origem text,ator_id uuid,criado_em timestamptz,revisao integer) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_cliente_quarentena(p_cliente_id); return query select * from pcm.sso_listar_quarentena_csv(p_cliente_id,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_listar_quarentena_autorizada(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_quarentena_autorizada(uuid,uuid,integer) to authenticated;

create function pcm.sso_linhas_quarentena_autorizadas(p_lote_id uuid,p_apos integer,p_limite integer) returns table(numero integer,estado_declarado text,celulas jsonb,erros_declarados jsonb,revisao_linha integer,revisao_lote integer) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_quarentena_mediada(p_lote_id); return query select * from pcm.sso_listar_linhas_quarentena_csv(p_lote_id,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_linhas_quarentena_autorizadas(uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_linhas_quarentena_autorizadas(uuid,integer,integer) to authenticated;

create function pcm.sso_corrigir_quarentena_autorizada(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_numero integer,p_estado text,p_celulas jsonb,p_erros jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_quarentena_mediada(p_lote_id); return pcm.sso_corrigir_linha_quarentena_csv(p_request_id,p_lote_id,p_expected_revision,p_numero,p_estado,p_celulas,p_erros,p_motivo); end; $$;
revoke all on function pcm.sso_corrigir_quarentena_autorizada(uuid,uuid,integer,integer,text,jsonb,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_corrigir_quarentena_autorizada(uuid,uuid,integer,integer,text,jsonb,jsonb,text) to authenticated;

create function pcm.sso_historico_quarentena_autorizado(p_lote_id uuid,p_numero integer,p_apos integer,p_limite integer) returns table(revisao integer,estado_declarado text,celulas jsonb,erros_declarados jsonb,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_quarentena_mediada(p_lote_id); return query select * from pcm.sso_historico_linha_quarentena_csv(p_lote_id,p_numero,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_historico_quarentena_autorizado(uuid,integer,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_quarentena_autorizado(uuid,integer,integer,integer) to authenticated;

create function pcm.sso_validar_quarentena_autorizada(p_quarentena_id uuid,p_apos integer,p_limite integer) returns table(numero integer,erros text[],revisao_quarentena integer) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_quarentena_mediada(p_quarentena_id); return query select * from pcm.sso_validar_quarentena_csv(p_quarentena_id,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_validar_quarentena_autorizada(uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_validar_quarentena_autorizada(uuid,integer,integer) to authenticated;

create function pcm.sso_reconciliar_quarentena_autorizada(p_request_id uuid,p_quarentena_id uuid,p_expected_revision integer,p_confirma boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_quarentena_mediada(p_quarentena_id); return pcm.sso_reconciliar_quarentena_csv(p_request_id,p_quarentena_id,p_expected_revision,p_confirma); end; $$;
revoke all on function pcm.sso_reconciliar_quarentena_autorizada(uuid,uuid,integer,boolean) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reconciliar_quarentena_autorizada(uuid,uuid,integer,boolean) to authenticated;
