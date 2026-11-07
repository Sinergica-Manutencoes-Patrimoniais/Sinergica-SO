-- ADR-1225: somente leitura de recibo do próprio ator, sem executar decisão.
create function comercial.sso_portal_recibo_decisao_proposta(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_request_id uuid,p_proposta_id uuid,p_versao integer,p_decisao text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_payload jsonb; v_resultado jsonb;
begin
  if p_request_id is null or p_versao is null or p_versao<1 or p_decisao is null or p_decisao not in ('aceita','recusada')
    or length(coalesce(p_motivo,''))>2000 or (p_decisao='recusada' and nullif(btrim(p_motivo),'') is null) then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  perform comercial.sso_exigir_historico_proposta_portal(p_ator_id,p_cliente_id,p_os_id,p_proposta_id);
  v_payload:=jsonb_build_object('propostaId',p_proposta_id,'versao',p_versao,'decisao',p_decisao,'motivo',nullif(btrim(p_motivo),''));
  select c.resultado into v_resultado from comercial.sso_portal_proposta_comandos c where c.request_id=p_request_id and c.ator_id=p_ator_id and c.payload=v_payload;
  if not found then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  return v_resultado;
end; $$;
revoke all on function comercial.sso_portal_recibo_decisao_proposta(uuid,uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_portal_recibo_decisao_proposta(uuid,uuid,uuid,uuid,uuid,integer,text,text) to authenticated;
