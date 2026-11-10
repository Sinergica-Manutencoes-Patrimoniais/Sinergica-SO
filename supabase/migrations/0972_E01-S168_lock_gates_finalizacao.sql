-- ADR-0766: serializa desligamento de gates com fechamento da OS.
create or replace function pcm.sso_mediar_finalizacao_os(p_request_id uuid, p_cliente_id uuid, p_retorno_id uuid,
  p_expected_os_id uuid, p_atestacao_request_id uuid, p_expected_decisao integer,
  p_expected_status text, p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  -- Ordem fixa; nenhum lock é liberado antes do fim da transação.
  perform 1 from pcm.sso_mediacao_finalizacao_os_gate where id for share;
  perform 1 from pcm.sso_finalizar_os_validada_gate where id for share;
  perform 1 from pcm.sso_atestacao_pcm_gate where id for share;
  perform 1 from pcm.validacao_os_gate where id for share;
  perform 1 from pcm.sso_upload_evidencia_resposta_gate where id for share;
  perform 1 from pcm.sso_validacao_resposta_gate where id for share;
  perform pcm.sso_autorizar_mediacao_finalizacao_os(p_cliente_id);
  return pcm.sso_finalizar_os_validada_v2(p_request_id, p_cliente_id, p_retorno_id, p_expected_os_id,
    p_atestacao_request_id, p_expected_decisao, p_expected_status, p_expected_updated_at);
end; $$;
