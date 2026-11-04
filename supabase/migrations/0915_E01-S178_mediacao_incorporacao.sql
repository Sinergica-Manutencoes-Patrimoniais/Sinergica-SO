create function pcm.sso_aplicar_sistema_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_sistema_id uuid,p_snapshot jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_aplicar_campos_sistema_levantamento(p_request_id,p_lote_id,p_expected_revision,p_chave,p_sistema_id,p_snapshot,p_motivo); end; $$;
revoke all on function pcm.sso_aplicar_sistema_autorizado(uuid,uuid,integer,text,uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_aplicar_sistema_autorizado(uuid,uuid,integer,text,uuid,jsonb,text) to authenticated;

create function pcm.sso_aplicar_componente_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_entidade_id uuid,p_snapshot jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_aplicar_campos_componente_levantamento(p_request_id,p_lote_id,p_expected_revision,p_chave,p_entidade_id,p_snapshot,p_motivo); end; $$;
revoke all on function pcm.sso_aplicar_componente_autorizado(uuid,uuid,integer,text,uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_aplicar_componente_autorizado(uuid,uuid,integer,text,uuid,jsonb,text) to authenticated;

create function pcm.sso_aplicar_localizacao_autorizado(p_request_id uuid,p_request_individual uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_entidade_id uuid,p_snapshot jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_aplicar_campos_localizacao(p_request_id,p_request_individual,p_lote_id,p_expected_revision,p_chave,p_entidade_id,p_snapshot,p_motivo); end; $$;
revoke all on function pcm.sso_aplicar_localizacao_autorizado(uuid,uuid,uuid,integer,text,uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_aplicar_localizacao_autorizado(uuid,uuid,uuid,integer,text,uuid,jsonb,text) to authenticated;

create function pcm.sso_criar_localizacoes_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_itens jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_criar_localizacoes_selecao(p_request_id,p_lote_id,p_expected_revision,p_itens); end; $$;
revoke all on function pcm.sso_criar_localizacoes_autorizado(uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_criar_localizacoes_autorizado(uuid,uuid,integer,jsonb) to authenticated;

create function pcm.sso_criar_ativos_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_itens jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_criar_ativos_selecao(p_request_id,p_lote_id,p_expected_revision,p_itens); end; $$;
revoke all on function pcm.sso_criar_ativos_autorizado(uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_criar_ativos_autorizado(uuid,uuid,integer,jsonb) to authenticated;

create function pcm.sso_criar_grupos_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_itens jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return pcm.sso_criar_grupos_selecao(p_request_id,p_lote_id,p_expected_revision,p_itens); end; $$;
revoke all on function pcm.sso_criar_grupos_autorizado(uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_criar_grupos_autorizado(uuid,uuid,integer,jsonb) to authenticated;
