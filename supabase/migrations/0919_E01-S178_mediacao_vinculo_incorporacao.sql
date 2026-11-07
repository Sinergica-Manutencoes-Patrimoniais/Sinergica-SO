create function pcm.sso_vincular_ativo_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_entidade_id uuid,p_local_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_vincular_ativo_levantamento(p_request_id,p_lote_id,p_expected_revision,p_chave,p_entidade_id,p_local_id); end; $$;
revoke all on function pcm.sso_vincular_ativo_autorizado(uuid,uuid,integer,text,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_vincular_ativo_autorizado(uuid,uuid,integer,text,uuid,uuid) to authenticated;

create function pcm.sso_incorporar_ativo_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_local_id uuid,p_categoria_id uuid,p_sistema_id uuid,p_parent_id uuid,p_codigo text,p_quantidade bigint,p_codigo_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_incorporar_ativo_codigo_staging(p_request_id,p_lote_id,p_expected_revision,p_chave,p_local_id,p_categoria_id,p_sistema_id,p_parent_id,p_codigo,p_quantidade,p_codigo_revision); end; $$;
revoke all on function pcm.sso_incorporar_ativo_autorizado(uuid,uuid,integer,text,uuid,uuid,uuid,uuid,text,bigint,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_incorporar_ativo_autorizado(uuid,uuid,integer,text,uuid,uuid,uuid,uuid,text,bigint,integer) to authenticated;

create function pcm.sso_atualizar_localizacao_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_entidade_id uuid,p_snapshot jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_atualizar_localizacao_levantamento(p_request_id,p_lote_id,p_expected_revision,p_chave,p_entidade_id,p_snapshot,p_motivo); end; $$;
revoke all on function pcm.sso_atualizar_localizacao_autorizado(uuid,uuid,integer,text,uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_atualizar_localizacao_autorizado(uuid,uuid,integer,text,uuid,jsonb,text) to authenticated;

create function pcm.sso_atualizar_selecao_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_itens jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_atualizar_selecao_levantamento(p_request_id,p_lote_id,p_expected_revision,p_itens); end; $$;
revoke all on function pcm.sso_atualizar_selecao_autorizado(uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_atualizar_selecao_autorizado(uuid,uuid,integer,jsonb) to authenticated;

create function pcm.sso_aplicar_localizacoes_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_itens jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_aplicar_localizacoes_selecao(p_request_id,p_lote_id,p_expected_revision,p_itens); end; $$;
revoke all on function pcm.sso_aplicar_localizacoes_autorizado(uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_aplicar_localizacoes_autorizado(uuid,uuid,integer,jsonb) to authenticated;
