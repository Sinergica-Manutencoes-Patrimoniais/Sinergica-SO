-- ADR-1328: consulta da reserva, sem liberar, reenviar ou confirmar efeito.
create function pcm.sso_listar_reservas_envio_legado(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(reserva_id uuid,os_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_reserva_envio_legado_gate where id and habilitado for share;
  if not found then raise exception 'reserva_envio_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select r.id,r.os_id,r.criado_em from pcm.sso_reservas_envio_legado r
    where r.cliente_id=p_cliente_id and r.estado='pendente' and (p_apos is null or r.id>p_apos)
    order by r.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_reservas_envio_legado(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_reservas_envio_legado(uuid,uuid,uuid,integer) to authenticated;
