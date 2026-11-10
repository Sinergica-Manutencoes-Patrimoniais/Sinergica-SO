-- ADR-1217: consulta do recibo existente, sem executar a atribuição.
create function pcm.sso_consultar_recibo_tecnico_despesa(p_ator_id uuid,p_cliente_id uuid,p_visita_id uuid,p_request_id uuid,p_despesa_id uuid,p_expected_revision integer,p_participacao_id uuid,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb; v_payload jsonb;
begin
  if p_request_id is null or p_despesa_id is null or p_expected_revision is null or p_expected_revision<1
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  perform pcm.sso_exigir_atribuicao_tecnico_mediada(p_ator_id,p_cliente_id,p_visita_id);
  perform 1 from pcm.despesas_visita where id=p_despesa_id and cliente_id=p_cliente_id and visita_id=p_visita_id for share;
  if not found then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('operacao','atribuir_tecnico','despesaId',p_despesa_id,'expectedRevision',p_expected_revision,'participacaoId',p_participacao_id,'motivo',btrim(p_motivo));
  select c.resultado into v_resultado from pcm.despesa_visita_comandos c where c.request_id=p_request_id and c.actor_id=p_ator_id and c.cliente_id=p_cliente_id and c.payload=v_payload;
  if not found then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  return v_resultado;
end; $$;
revoke all on function pcm.sso_consultar_recibo_tecnico_despesa(uuid,uuid,uuid,uuid,uuid,integer,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_recibo_tecnico_despesa(uuid,uuid,uuid,uuid,uuid,integer,uuid,text) to authenticated;
