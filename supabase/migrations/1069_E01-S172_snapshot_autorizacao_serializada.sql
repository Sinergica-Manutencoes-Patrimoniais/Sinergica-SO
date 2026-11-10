-- ADR-0884: entrada serializada; os gates existentes permanecem fechados.
create function pcm.sso_snapshot_capacidade_autorizado(p_cliente_id uuid,p_semana_inicio date,p_versao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if p_versao is null or p_versao not between 1 and 5 then
    raise exception 'versao_snapshot_invalida' using errcode='22023';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  -- Travas também protegem gates opcionais: seus valores são reavaliados pelos núcleos.
  perform 1 from pcm.capacidade_esforco_declarado_gate where id for share;
  perform 1 from pcm.capacidade_fontes_mediacao_gate where id for share;
  perform 1 from pcm.capacidade_demanda_gate where id for share;
  perform 1 from pcm.sso_fila_obrigacoes_preparadas_gate where id for share;
  if p_versao >= 2 then
    perform 1 from pcm.sso_origem_execucao_unificada_gate where id for share;
  end if;
  if p_versao >= 3 then
    perform 1 from pcm.sso_mediacao_finalizacao_os_gate where id for share;
    perform 1 from pcm.sso_finalizar_os_validada_gate where id for share;
  end if;
  if p_versao >= 5 then
    perform 1 from pcm.capacidade_vinculo_intervalo_gate where id for share;
  end if;
  case p_versao
    when 1 then return pcm.sso_mediar_snapshot_capacidade(p_cliente_id,p_semana_inicio);
    when 2 then return pcm.sso_mediar_snapshot_capacidade_v2(p_cliente_id,p_semana_inicio);
    when 3 then return pcm.sso_mediar_snapshot_capacidade_v3(p_cliente_id,p_semana_inicio);
    when 4 then return pcm.sso_mediar_snapshot_capacidade_v4(p_cliente_id,p_semana_inicio);
    when 5 then return pcm.sso_mediar_snapshot_capacidade_v5(p_cliente_id,p_semana_inicio);
  end case;
end;
$$;
revoke all on function pcm.sso_snapshot_capacidade_autorizado(uuid,date,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_snapshot_capacidade_autorizado(uuid,date,integer) to authenticated;
revoke execute on function pcm.sso_mediar_snapshot_capacidade(uuid,date) from public,anon,authenticated,service_role;
revoke execute on function pcm.sso_mediar_snapshot_capacidade_v2(uuid,date) from public,anon,authenticated,service_role;
revoke execute on function pcm.sso_mediar_snapshot_capacidade_v3(uuid,date) from public,anon,authenticated,service_role;
revoke execute on function pcm.sso_mediar_snapshot_capacidade_v4(uuid,date) from public,anon,authenticated,service_role;
revoke execute on function pcm.sso_mediar_snapshot_capacidade_v5(uuid,date) from public,anon,authenticated,service_role;
