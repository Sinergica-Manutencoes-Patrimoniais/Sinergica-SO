-- ADR-0886: leitura individual serializada, mantendo os núcleos e seu contrato.
create function pcm.sso_consultar_esforco_autorizado(p_cliente_id uuid,p_origem_tipo text,p_origem_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  perform 1 from pcm.capacidade_esforco_declarado_gate where id for share;
  if p_origem_tipo = 'ocorrencia_visita' then
    return pcm.sso_consultar_esforco_ocorrencia_visita(p_cliente_id,p_origem_id);
  end if;
  return pcm.sso_consultar_esforco_declarado(p_cliente_id,p_origem_tipo,p_origem_id);
end; $$;
revoke all on function pcm.sso_consultar_esforco_autorizado(uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_esforco_autorizado(uuid,text,uuid) to authenticated;
revoke execute on function pcm.sso_consultar_esforco_declarado(uuid,text,uuid),pcm.sso_consultar_esforco_ocorrencia_visita(uuid,uuid) from public,anon,authenticated,service_role;
