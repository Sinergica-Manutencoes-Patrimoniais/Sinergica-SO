-- ADR-0862: complementa mediação desligada da ADR-0860; não concede núcleos privados.
do $migration$
declare v_def text; v_old text:='select habilitado from pcm.sso_cronograma_staging_gate where id';
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_listar_alvos_cronograma(uuid,text,uuid,text,integer)'::regprocedure) into v_def;
 if (length(v_def)-length(replace(v_def,v_old,'')))/length(v_old)<>1 then raise exception 'definicao_alvos_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_old,'select g.habilitado from pcm.sso_cronograma_staging_gate g where g.id');
end; $migration$;
revoke all on function pcm.sso_listar_alvos_cronograma(uuid,text,uuid,text,integer) from public,anon,authenticated,service_role;

create function pcm.sso_classificar_cronograma_mediado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave_linha text,p_tipo text,p_conferencia text,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_cliente uuid;
begin
 select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id;
 perform pcm.sso_exigir_mediacao_cronograma(v_cliente);
 return pcm.sso_classificar_linha_cronograma(p_request_id,p_lote_id,p_expected_revision,p_chave_linha,p_tipo,p_conferencia,p_justificativa);
end; $$;

create function pcm.sso_mapear_cronograma_mediado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_numero_linha integer,p_disciplina text,p_nome_rotina text,p_alvo_tipo text,p_alvo_id uuid,p_modo text,p_intervalo integer,p_unidade text,p_data_base date,p_tempo_minutos integer,p_premissa_mensal text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_cliente uuid;
begin
 select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id;
 perform pcm.sso_exigir_mediacao_cronograma(v_cliente);
 return pcm.sso_mapear_linha_cronograma(p_request_id,p_lote_id,p_expected_revision,p_numero_linha,p_disciplina,p_nome_rotina,p_alvo_tipo,p_alvo_id,p_modo,p_intervalo,p_unidade,p_data_base,p_tempo_minutos,p_premissa_mensal);
end; $$;

create function pcm.sso_listar_mapeamentos_mediado(p_cliente_id uuid,p_lote_id uuid,p_apos text,p_limite integer)
returns setof pcm.sso_cronograma_mapeamentos language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente_id); return query select * from pcm.sso_listar_mapeamentos_cronograma(p_cliente_id,p_lote_id,p_apos,p_limite); end; $$;

create function pcm.sso_listar_alvos_cronograma_mediado(p_cliente_id uuid,p_tipo text,p_apos uuid,p_busca text,p_limite integer)
returns table(id uuid,nome text) language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente_id); return query select * from pcm.sso_listar_alvos_cronograma(p_cliente_id,p_tipo,p_apos,p_busca,p_limite); end; $$;

revoke all on function pcm.sso_classificar_cronograma_mediado(uuid,uuid,integer,text,text,text,text),pcm.sso_mapear_cronograma_mediado(uuid,uuid,integer,integer,text,text,text,uuid,text,integer,text,date,integer,text),pcm.sso_listar_mapeamentos_mediado(uuid,uuid,text,integer),pcm.sso_listar_alvos_cronograma_mediado(uuid,text,uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_classificar_cronograma_mediado(uuid,uuid,integer,text,text,text,text),pcm.sso_mapear_cronograma_mediado(uuid,uuid,integer,integer,text,text,text,uuid,text,integer,text,date,integer,text),pcm.sso_listar_mapeamentos_mediado(uuid,uuid,text,integer),pcm.sso_listar_alvos_cronograma_mediado(uuid,text,uuid,text,integer) to authenticated;
