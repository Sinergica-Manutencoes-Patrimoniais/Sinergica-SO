create function pcm.sso_historico_sistema_autorizado(p_lote_id uuid,p_chave text,p_apos integer,p_limite integer)
returns table(revisao_lote integer,campos jsonb,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return query select * from pcm.sso_historico_campos_sistema_staging(p_lote_id,p_chave,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_historico_sistema_autorizado(uuid,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_sistema_autorizado(uuid,text,integer,integer) to authenticated;

create function pcm.sso_historico_componente_autorizado(p_lote_id uuid,p_chave text,p_apos integer,p_limite integer)
returns table(revisao_lote integer,campos jsonb,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return query select * from pcm.sso_historico_campos_componente_staging(p_lote_id,p_chave,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_historico_componente_autorizado(uuid,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_componente_autorizado(uuid,text,integer,integer) to authenticated;

create function pcm.sso_historico_localizacao_autorizado(p_lote_id uuid,p_chave text,p_apos integer,p_limite integer)
returns table(revisao integer,revisao_campos integer,ciclo integer,campos jsonb,ator_id uuid,motivo text,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return query select * from pcm.sso_listar_conferencias_campos_localizacao(p_lote_id,p_chave,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_historico_localizacao_autorizado(uuid,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_localizacao_autorizado(uuid,text,integer,integer) to authenticated;

create function pcm.sso_historico_edicao_linha_autorizado(p_lote_id uuid,p_chave text,p_apos integer,p_limite integer)
returns table(revisao integer,antes jsonb,depois jsonb,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return query select * from pcm.sso_listar_edicoes_linha_staging(p_lote_id,p_chave,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_historico_edicao_linha_autorizado(uuid,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_edicao_linha_autorizado(uuid,text,integer,integer) to authenticated;

create function pcm.sso_historico_rejeicao_autorizado(p_lote_id uuid,p_chave text,p_apos integer,p_limite integer)
returns table(rejeicao_revision integer,rejeicao_motivo text,rejeicao_ator uuid,rejeicao_em timestamptz,reabertura_revision integer,reabertura_motivo text,reabertura_ator uuid,reabertura_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return query select * from pcm.sso_historico_rejeicao_linha(p_lote_id,p_chave,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_historico_rejeicao_autorizado(uuid,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_rejeicao_autorizado(uuid,text,integer,integer) to authenticated;
