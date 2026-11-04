create function pcm.sso_classificacao_linhas_autorizada(p_lote_id uuid,p_apos text,p_limite integer)
returns table(chave text,tipo text,problemas text[],possiveis_duplicatas bigint,classificacao text) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return query select * from pcm.sso_classificar_linhas_levantamento(p_lote_id,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_classificacao_linhas_autorizada(uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_classificacao_linhas_autorizada(uuid,text,integer) to authenticated;

create function pcm.sso_conferencia_codigos_autorizada(p_lote_id uuid,p_apos text,p_limite integer)
returns table(chave text,tipo text,codigo_informado text,codigo_candidato text,formato_invalido boolean,codigos_divergentes boolean,outras_linhas bigint,cadastros_cliente bigint,aliases_cliente bigint) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return query select * from pcm.sso_conferir_codigos_lote(p_lote_id,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_conferencia_codigos_autorizada(uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_conferencia_codigos_autorizada(uuid,text,integer) to authenticated;

create function pcm.sso_linhas_editadas_autorizadas(p_lote_id uuid,p_apos text,p_limite integer)
returns table(linha_chave text,ultima_revisao integer,ciclo_atual integer,estado text) language plpgsql stable security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_conferencia(p_lote_id); return query select * from pcm.sso_listar_linhas_editadas_lote(p_lote_id,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_linhas_editadas_autorizadas(uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_linhas_editadas_autorizadas(uuid,text,integer) to authenticated;
