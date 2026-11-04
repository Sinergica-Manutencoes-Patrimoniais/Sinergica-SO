-- ADR-0866: mediação sob gates já fechados, sem conceder núcleos privados.
do $migration$
declare v_def text; v_antigo text; v_novo text; v_n integer;
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_listar_propostas_reprocessamento(uuid,uuid,uuid,uuid,integer)'::regprocedure) into v_def;
 for v_antigo,v_novo in values
  ('select habilitado from pcm.sso_cronograma_staging_gate where id','select g.habilitado from pcm.sso_cronograma_staging_gate g where g.id'),
  ('select habilitado from pcm.sso_cronograma_aprovacao_gate where id','select g.habilitado from pcm.sso_cronograma_aprovacao_gate g where g.id'),
  ('select habilitado from pcm.sso_cronograma_incorporacao_gate where id','select g.habilitado from pcm.sso_cronograma_incorporacao_gate g where g.id'),
  ('select 1 from pcm.sso_levantamentos where id=p_lote_id and cliente_id=p_cliente_id','select 1 from pcm.sso_levantamentos l where l.id=p_lote_id and l.cliente_id=p_cliente_id'),
  ('select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id','select 1 from pcm.planos_manutencao pl where pl.id=p_plano_id and pl.cliente_id=p_cliente_id')
 loop
  v_n:=(length(v_def)-length(replace(v_def,v_antigo,'')))/length(v_antigo);
  if v_n<>1 then raise exception 'definicao_propostas_incompativel' using errcode='55000'; end if;
  v_def:=replace(v_def,v_antigo,v_novo);
 end loop;
 execute v_def;
end; $migration$;
revoke all on function pcm.sso_listar_propostas_reprocessamento(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_tolerancia_cronograma_mediada(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_mapeamento_id uuid,p_antes integer,p_depois integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_cliente uuid; begin select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id; perform pcm.sso_exigir_mediacao_cronograma(v_cliente); return pcm.sso_tolerancia_mapeamento_cronograma(p_request_id,p_lote_id,p_expected_revision,p_chave,p_mapeamento_id,p_antes,p_depois); end; $$;
create function pcm.sso_obter_tolerancia_mediada(p_cliente_id uuid,p_lote_id uuid,p_mapeamento_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente_id); return pcm.sso_obter_tolerancia_cronograma(p_cliente_id,p_lote_id,p_mapeamento_id); end; $$;
create function pcm.sso_propor_reprocessamento_mediado(p_request_id uuid,p_cliente_id uuid,p_lote_id uuid,p_expected_lote_revision integer,p_chave text,p_plano_id uuid,p_expected_plano_revision integer,p_justificativa text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente_id); perform 1 from pcm.sso_cronograma_staging_gate where id for share; perform 1 from pcm.sso_cronograma_aprovacao_gate where id for share; perform 1 from pcm.sso_cronograma_incorporacao_gate where id for share; return pcm.sso_propor_reprocessamento_cronograma(p_request_id,p_cliente_id,p_lote_id,p_expected_lote_revision,p_chave,p_plano_id,p_expected_plano_revision,p_justificativa); end; $$;
create function pcm.sso_aplicar_reprocessamento_mediado(p_request_id uuid,p_cliente_id uuid,p_proposta_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente_id); perform 1 from pcm.sso_cronograma_staging_gate where id for share; perform 1 from pcm.sso_cronograma_aprovacao_gate where id for share; perform 1 from pcm.sso_cronograma_incorporacao_gate where id for share; return pcm.sso_aplicar_reprocessamento_cronograma(p_request_id,p_cliente_id,p_proposta_id); end; $$;
create function pcm.sso_listar_reprocessamentos_mediado(p_cliente_id uuid,p_lote_id uuid,p_plano_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,chave_linha text,rotina_id uuid,revisao_lote integer,revisao_plano integer,antes jsonb,depois jsonb,justificativa text,criado_em timestamptz,aplicada boolean) language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente_id); return query select * from pcm.sso_listar_propostas_reprocessamento(p_cliente_id,p_lote_id,p_plano_id,p_apos,p_limite); end; $$;
revoke all on function pcm.sso_tolerancia_cronograma_mediada(uuid,uuid,integer,text,uuid,integer,integer),pcm.sso_obter_tolerancia_mediada(uuid,uuid,uuid),pcm.sso_propor_reprocessamento_mediado(uuid,uuid,uuid,integer,text,uuid,integer,text),pcm.sso_aplicar_reprocessamento_mediado(uuid,uuid,uuid),pcm.sso_listar_reprocessamentos_mediado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_tolerancia_cronograma_mediada(uuid,uuid,integer,text,uuid,integer,integer),pcm.sso_obter_tolerancia_mediada(uuid,uuid,uuid),pcm.sso_propor_reprocessamento_mediado(uuid,uuid,uuid,integer,text,uuid,integer,text),pcm.sso_aplicar_reprocessamento_mediado(uuid,uuid,uuid),pcm.sso_listar_reprocessamentos_mediado(uuid,uuid,uuid,uuid,integer) to authenticated;
