-- ADR-0896: o ator esperado limita a tentativa; não substitui autorização.
create function pcm.sso_reconciliar_cronograma_por_ator(
  p_ator_id uuid,p_request_id uuid,p_lote_id uuid,p_cliente_id uuid,p_revisao integer,p_motivo text
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_ator_id is null or auth.uid() is distinct from p_ator_id then
    raise exception 'sessao_divergente' using errcode='42501';
  end if;
  return pcm.sso_reconciliar_cronograma_conferido(p_request_id,p_lote_id,p_cliente_id,p_revisao,p_motivo);
end; $$;
revoke all on function pcm.sso_reconciliar_cronograma_por_ator(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reconciliar_cronograma_por_ator(uuid,uuid,uuid,uuid,integer,text) to authenticated;
revoke execute on function pcm.sso_reconciliar_cronograma_conferido(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
