-- ADR-0865. Reuso da mediação da 1048, preservando núcleos privados.
do $migration$
declare v_fun regprocedure; v_def text; v_old text:='select habilitado from pcm.sso_cronograma_staging_gate where id';
begin
 for v_fun in select unnest(array['pcm.sso_listar_revisoes_linha_cronograma(uuid,uuid,text,integer,integer)'::regprocedure]) loop
  select pg_catalog.pg_get_functiondef(v_fun) into v_def;
  if (length(v_def)-length(replace(v_def,v_old,'')))/length(v_old)<>1 then raise exception 'definicao_revisoes_incompativel' using errcode='55000'; end if;
  execute replace(v_def,v_old,'select g.habilitado from pcm.sso_cronograma_staging_gate g where g.id');
 end loop;
end; $migration$;
revoke all on function pcm.sso_listar_revisoes_linha_cronograma(uuid,uuid,text,integer,integer) from public,anon,authenticated,service_role;

create function pcm.sso_identificar_cronograma_mediado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave_linha text,p_identidade text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_cliente uuid; begin select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id; perform pcm.sso_exigir_mediacao_cronograma(v_cliente); return pcm.sso_identificar_linha_cronograma(p_request_id,p_lote_id,p_expected_revision,p_chave_linha,p_identidade); end; $$;
create function pcm.sso_revisar_cronograma_mediado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave_linha text,p_estado text,p_justificativa text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_cliente uuid; begin select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id; perform pcm.sso_exigir_mediacao_cronograma(v_cliente); return pcm.sso_revisar_linha_cronograma(p_request_id,p_lote_id,p_expected_revision,p_chave_linha,p_estado,p_justificativa); end; $$;
create function pcm.sso_listar_revisoes_cronograma_mediado(p_cliente_id uuid,p_lote_id uuid,p_chave_linha text,p_apos integer,p_limite integer)
returns table(id uuid,revisao_lote integer,estado text,justificativa text,ator_id uuid,criado_em timestamptz) language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente_id); return query select * from pcm.sso_listar_revisoes_linha_cronograma(p_cliente_id,p_lote_id,p_chave_linha,p_apos,p_limite); end; $$;
create function pcm.sso_conferir_cronograma_mediado(p_cliente_id uuid,p_lote_id uuid,p_apos text,p_limite integer)
returns table(chave text,tipo_linha text,conferencia text,identidade text,mapeamento_id uuid,situacao text,pendencias text[],alvo_atual text) language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente_id); return query select * from pcm.sso_conferir_alvos_cronograma(p_cliente_id,p_lote_id,p_apos,p_limite); end; $$;
create function pcm.sso_diagnosticar_cronograma_mediado(p_cliente_id uuid,p_lote_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente_id); return pcm.sso_diagnosticar_aprovacao_cronograma(p_cliente_id,p_lote_id); end; $$;
create function pcm.sso_comparar_cronogramas_mediado(p_cliente_id uuid,p_anterior uuid,p_novo uuid,p_apos text,p_limite integer)
returns table(identidade text,chave_anterior text,chave_nova text,estado text) language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente_id); return query select * from pcm.sso_comparar_identidades_cronograma(p_cliente_id,p_anterior,p_novo,p_apos,p_limite); end; $$;
create function pcm.sso_aprovar_cronograma_mediado(p_request_id uuid,p_cliente_id uuid,p_lote_id uuid,p_expected_revision integer,p_justificativa text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente_id); perform 1 from pcm.sso_cronograma_staging_gate where id for share; perform 1 from pcm.sso_cronograma_aprovacao_gate where id for share; return pcm.sso_aprovar_lote_cronograma_staging(p_request_id,p_cliente_id,p_lote_id,p_expected_revision,p_justificativa); end; $$;
create function pcm.sso_preparar_importacao_mediada(p_cliente_id uuid,p_lote_id uuid,p_plano_id uuid,p_apos text,p_limite integer)
returns table(chave text,candidata boolean,identidade text,mapeamento_id uuid,alvo_atual text,pendencias text[],revisao_lote integer,revisao_plano integer,aprovacao_id uuid) language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente_id); return query select * from pcm.sso_preparar_importacao_cronograma(p_cliente_id,p_lote_id,p_plano_id,p_apos,p_limite); end; $$;
create function pcm.sso_incorporar_linha_cronograma_mediado(p_request_id uuid,p_cliente_id uuid,p_lote_id uuid,p_expected_lote_revision integer,p_chave text,p_plano_id uuid,p_expected_plano_revision integer,p_rotina_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente_id); perform 1 from pcm.sso_cronograma_staging_gate where id for share; perform 1 from pcm.sso_cronograma_aprovacao_gate where id for share; perform 1 from pcm.sso_cronograma_incorporacao_gate where id for share; return pcm.sso_incorporar_linha_cronograma(p_request_id,p_cliente_id,p_lote_id,p_expected_lote_revision,p_chave,p_plano_id,p_expected_plano_revision,p_rotina_id); end; $$;
create function pcm.sso_incorporar_lote_cronograma_mediado(p_request_id uuid,p_cliente_id uuid,p_lote_id uuid,p_expected_lote_revision integer,p_plano_id uuid,p_expected_plano_revision integer,p_linhas jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente_id); perform 1 from pcm.sso_cronograma_staging_gate where id for share; perform 1 from pcm.sso_cronograma_aprovacao_gate where id for share; perform 1 from pcm.sso_cronograma_incorporacao_gate where id for share; return pcm.sso_incorporar_lote_cronograma(p_request_id,p_cliente_id,p_lote_id,p_expected_lote_revision,p_plano_id,p_expected_plano_revision,p_linhas); end; $$;

revoke all on function pcm.sso_identificar_cronograma_mediado(uuid,uuid,integer,text,text),pcm.sso_revisar_cronograma_mediado(uuid,uuid,integer,text,text,text),pcm.sso_listar_revisoes_cronograma_mediado(uuid,uuid,text,integer,integer),pcm.sso_conferir_cronograma_mediado(uuid,uuid,text,integer),pcm.sso_diagnosticar_cronograma_mediado(uuid,uuid),pcm.sso_comparar_cronogramas_mediado(uuid,uuid,uuid,text,integer),pcm.sso_aprovar_cronograma_mediado(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_identificar_cronograma_mediado(uuid,uuid,integer,text,text),pcm.sso_revisar_cronograma_mediado(uuid,uuid,integer,text,text,text),pcm.sso_listar_revisoes_cronograma_mediado(uuid,uuid,text,integer,integer),pcm.sso_conferir_cronograma_mediado(uuid,uuid,text,integer),pcm.sso_diagnosticar_cronograma_mediado(uuid,uuid),pcm.sso_comparar_cronogramas_mediado(uuid,uuid,uuid,text,integer),pcm.sso_aprovar_cronograma_mediado(uuid,uuid,uuid,integer,text) to authenticated;
revoke all on function pcm.sso_preparar_importacao_mediada(uuid,uuid,uuid,text,integer),pcm.sso_incorporar_linha_cronograma_mediado(uuid,uuid,uuid,integer,text,uuid,integer,uuid),pcm.sso_incorporar_lote_cronograma_mediado(uuid,uuid,uuid,integer,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_preparar_importacao_mediada(uuid,uuid,uuid,text,integer),pcm.sso_incorporar_linha_cronograma_mediado(uuid,uuid,uuid,integer,text,uuid,integer,uuid),pcm.sso_incorporar_lote_cronograma_mediado(uuid,uuid,uuid,integer,uuid,integer,jsonb) to authenticated;
