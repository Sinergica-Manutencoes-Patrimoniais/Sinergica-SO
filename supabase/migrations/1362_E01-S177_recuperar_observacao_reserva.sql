-- ADR-1207: recibo local de observação sem depender de reserva ainda ativa.
create function pcm.sso_consultar_recibo_observacao_reserva(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_outbox_id uuid,p_componente_id uuid,p_observacao text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_observacao pcm.sso_observacoes_reserva_equipment%rowtype;
begin
  if auth.uid() is null or p_ator_id is distinct from auth.uid() or p_cliente_id is null or p_request_id is null
    or p_outbox_id is null or p_componente_id is null or p_observacao is null or length(btrim(p_observacao)) not between 1 and 2000 then
    raise exception 'recibo_indisponivel' using errcode = '42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_observacao_reserva_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'observacao_reserva_desabilitada' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'recibo_indisponivel' using errcode = '42501'; end if;
  perform 1 from pcm.equipamentos e where e.id=p_componente_id and e.client_id=p_cliente_id for share;
  if not found then raise exception 'recibo_indisponivel' using errcode = '42501'; end if;
  select * into v_observacao from pcm.sso_observacoes_reserva_equipment o
    where o.request_id=p_request_id and o.cliente_id=p_cliente_id and o.ator_id=p_ator_id and o.outbox_id=p_outbox_id
      and o.componente_id=p_componente_id and o.observacao=btrim(p_observacao);
  if not found then raise exception 'recibo_indisponivel' using errcode = '42501'; end if;
  return jsonb_build_object('requestId',v_observacao.request_id,'outboxId',v_observacao.outbox_id,
    'componenteId',v_observacao.componente_id,'criadoEm',v_observacao.criado_em);
end; $$;
revoke all on function pcm.sso_consultar_recibo_observacao_reserva(uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_recibo_observacao_reserva(uuid,uuid,uuid,uuid,uuid,text) to authenticated;
