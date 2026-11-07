-- ADR-1193: leitura parcial por Cliente, sem concessão às funções privadas.
create function pcm.sso_horizonte_capacidade_grupo_mediado(p_ator_id uuid,p_cliente_id uuid,p_semana_inicio date,p_quantidade integer)
returns table(semana_inicio date,visitas bigint,declaracoes bigint,grupos_lidos integer,grupos_sem_tempo integer,grupos_com_sobreposicao integer,subtotal_grupo_sem_os_minutos text,fonte_truncada boolean,demanda_completa boolean,disponibilidade_completa boolean,saldo_minutos text)
language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null
    or p_semana_inicio is null or not pg_catalog.isfinite(p_semana_inicio) or extract(isodow from p_semana_inicio) <> 1
    or p_quantidade is null or p_quantidade not between 1 and 12 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.capacidade_horizonte_gate where id and habilitado for share;
  if not found then raise exception 'horizonte_capacidade_bloqueado' using errcode='55000'; end if;
  perform 1 from pcm.sso_demanda_grupo_visita_gate where id and habilitado for share;
  if not found then raise exception 'demanda_grupo_bloqueada' using errcode='55000'; end if;
  perform 1 from pcm.sso_horizonte_grupo_gate where id and habilitado for share;
  if not found then raise exception 'horizonte_grupo_bloqueado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select h.semana_inicio,h.visitas,h.declaracoes,h.grupos_lidos,h.grupos_sem_tempo,h.grupos_com_sobreposicao,
    h.subtotal_grupo_sem_os_minutos,h.fonte_truncada,h.demanda_completa,h.disponibilidade_completa,h.saldo_minutos
    from pcm.sso_horizonte_capacidade_grupo(p_cliente_id,p_semana_inicio,p_quantidade) h;
end; $$;
revoke all on function pcm.sso_horizonte_capacidade_grupo_mediado(uuid,uuid,date,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_horizonte_capacidade_grupo_mediado(uuid,uuid,date,integer) to authenticated;
