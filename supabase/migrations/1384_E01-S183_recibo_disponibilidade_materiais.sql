-- ADR-1229: consulta de recibo, sem repetir informação de disponibilidade.
create function pcm.sso_portal_recibo_disponibilidade_material(
  p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_request_id uuid,
  p_lista_id uuid,p_expected_revision integer,p_situacao text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_payload jsonb; v_resultado jsonb;
begin
  if p_request_id is null or p_lista_id is null or p_expected_revision is null
    or p_expected_revision<1 or p_situacao is null
    or p_situacao not in ('informada_disponivel','parcial','indisponivel') then
    raise exception 'recibo_indisponivel' using errcode='42501';
  end if;
  perform pcm.sso_exigir_historico_materiais_portal(p_ator_id,p_cliente_id,p_os_id);
  perform 1 from pcm.listas_materiais l where l.id=p_lista_id and l.cliente_id=p_cliente_id
    and l.ordem_servico_id=p_os_id for share;
  if not found then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('operacao','informar','listaId',p_lista_id,
    'expectedRevision',p_expected_revision,'situacao',p_situacao);
  select c.resultado into v_resultado from pcm.sso_portal_materiais_comandos c
    where c.request_id=p_request_id and c.ator_id=p_ator_id and c.payload=v_payload;
  if not found then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  return v_resultado;
end; $$;
revoke all on function pcm.sso_portal_recibo_disponibilidade_material(uuid,uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_portal_recibo_disponibilidade_material(uuid,uuid,uuid,uuid,uuid,integer,text) to authenticated;
