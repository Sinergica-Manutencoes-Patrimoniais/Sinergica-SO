-- ADR-1206: mediação autenticada com reserva e Cliente atuais.
create function pcm.sso_exigir_reserva_observavel(p_ator_id uuid,p_cliente_id uuid,p_outbox_id uuid,p_componente_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_ator_id is distinct from auth.uid() or p_cliente_id is null or p_outbox_id is null or p_componente_id is null then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_observacao_reserva_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'observacao_reserva_desabilitada' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  perform 1 from pcm.sso_reserva_equipment_outbox r join pcm.equipamentos e on e.id=r.componente_id
    where r.outbox_id=p_outbox_id and r.componente_id=p_componente_id and e.client_id=p_cliente_id for share of r,e;
  if not found then raise exception 'reserva_indisponivel_ou_sem_acesso' using errcode = '42501'; end if;
end; $$;
revoke all on function pcm.sso_exigir_reserva_observavel(uuid,uuid,uuid,uuid) from public, anon, authenticated, service_role;

create function pcm.sso_listar_observacoes_reserva_mediada(p_ator_id uuid,p_cliente_id uuid,p_outbox_id uuid,p_componente_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,ator_id uuid,observacao text,criado_em timestamptz) language plpgsql volatile security definer set search_path = '' as $$
begin
  perform pcm.sso_exigir_reserva_observavel(p_ator_id,p_cliente_id,p_outbox_id,p_componente_id);
  return query select * from pcm.sso_listar_observacoes_reserva(p_ator_id,p_cliente_id,p_outbox_id,p_componente_id,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_listar_observacoes_reserva_mediada(uuid,uuid,uuid,uuid,uuid,integer) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_listar_observacoes_reserva_mediada(uuid,uuid,uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_observar_reserva_equipment_mediada(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_outbox_id uuid,p_componente_id uuid,p_observacao text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_ator_id is distinct from auth.uid() or p_request_id is null then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  -- Mesma chave do núcleo; evita inverter a ordem entre request e reserva.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('observacao-reserva:' || p_request_id::text,0));
  perform pcm.sso_exigir_reserva_observavel(p_ator_id,p_cliente_id,p_outbox_id,p_componente_id);
  return pcm.sso_observar_reserva_equipment(p_ator_id,p_cliente_id,p_request_id,p_outbox_id,p_componente_id,p_observacao);
end; $$;
revoke all on function pcm.sso_observar_reserva_equipment_mediada(uuid,uuid,uuid,uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_observar_reserva_equipment_mediada(uuid,uuid,uuid,uuid,uuid,text) to authenticated;
