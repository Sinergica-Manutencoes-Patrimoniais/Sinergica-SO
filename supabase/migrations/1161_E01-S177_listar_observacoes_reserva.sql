-- ADR-1009: histórico limitado à reserva e ao Cliente autorizados.
create function pcm.sso_listar_observacoes_reserva(p_ator_id uuid,p_cliente_id uuid,p_outbox_id uuid,p_componente_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,ator_id uuid,observacao text,criado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_outbox_id is null or p_componente_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_observacao_reserva_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'observacao_reserva_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.sso_reserva_equipment_outbox r join pcm.equipamentos e on e.id=r.componente_id
    where r.outbox_id=p_outbox_id and r.componente_id=p_componente_id and e.client_id=p_cliente_id for share of r,e;
  if not found then raise exception 'reserva_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return query select o.request_id,o.ator_id,o.observacao,o.criado_em from pcm.sso_observacoes_reserva_equipment o
    where o.cliente_id=p_cliente_id and o.outbox_id=p_outbox_id and o.componente_id=p_componente_id and (p_apos is null or o.request_id>p_apos)
    order by o.request_id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_observacoes_reserva(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
