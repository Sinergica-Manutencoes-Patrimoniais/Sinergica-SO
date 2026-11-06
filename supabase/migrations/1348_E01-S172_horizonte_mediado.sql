-- ADR-1192: mediação da consulta parcial, sem concessão à função privada.
create function pcm.sso_horizonte_capacidade_mediado(p_ator_id uuid,p_cliente_id uuid,p_semana_inicio date,p_quantidade integer)
returns table(semana_inicio date,declaracoes bigint,visitas bigint,disponibilidade_completa boolean,demanda_completa boolean,
  disponibilidade_minutos bigint,demanda_minutos bigint,saldo_minutos bigint)
language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null
    or p_semana_inicio is null or not pg_catalog.isfinite(p_semana_inicio) or extract(isodow from p_semana_inicio) <> 1
    or p_quantidade is null or p_quantidade not between 1 and 12 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.capacidade_horizonte_gate where id and habilitado for share;
  if not found then raise exception 'horizonte_capacidade_bloqueado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select h.semana_inicio,h.declaracoes,h.visitas,h.disponibilidade_completa,h.demanda_completa,
    h.disponibilidade_minutos,h.demanda_minutos,h.saldo_minutos
    from pcm.sso_horizonte_capacidade_preparado(p_cliente_id,p_semana_inicio,p_quantidade) h;
end; $$;
revoke all on function pcm.sso_horizonte_capacidade_mediado(uuid,uuid,date,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_horizonte_capacidade_mediado(uuid,uuid,date,integer) to authenticated;
