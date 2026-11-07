-- ADR-1295: leitura do mesmo pedido, sem nova devolução.
create function pcm.sso_recibo_devolucao_parcial(p_ator_id uuid,p_cliente_id uuid,p_ciclo_id uuid,p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare c pcm.sso_comandos_retorno_parcial%rowtype;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_ciclo_id is null or p_request_id is null
    or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>8192 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_retorno_parcial_gate where id and habilitado for share;
  if not found then raise exception 'retorno_parcial_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  perform 1 from pcm.sso_continuacao_parcela_gate where id and habilitado for share;
  if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into c from pcm.sso_comandos_retorno_parcial where request_id=p_request_id and ator_id=p_ator_id and cliente_id=p_cliente_id and payload=p_payload and payload->>'cicloId'=p_ciclo_id::text;
  if not found or not exists(select 1 from pcm.sso_retornos_parciais r join pcm.sso_ciclos_backlog b on b.id=r.ciclo_id and b.cliente_id=r.cliente_id
    join pcm.chamados ch on ch.id=b.chamado_id and ch.cliente_id=b.cliente_id and ch.deleted_at is null
    where r.id=c.retorno_id and r.ciclo_id=p_ciclo_id and r.cliente_id=p_cliente_id) then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  return c.resultado;
end; $$;
revoke all on function pcm.sso_recibo_devolucao_parcial(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recibo_devolucao_parcial(uuid,uuid,uuid,uuid,jsonb) to authenticated;
