-- ADR-1191: consultas privadas permanecem privadas; gates existentes continuam fechados.
create function pcm.sso_impacto_rotinas_grupo_mediado(p_ator_id uuid,p_cliente_id uuid,p_grupo_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_grupo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_impacto_grupo_gate where id and habilitado for share;
  if not found then raise exception 'impacto_grupo_desabilitado' using errcode='55000'; end if;
  if not exists(select 1 from pcm.grupos_quantitativos g where g.id=p_grupo_id and g.cliente_id=p_cliente_id and g.ativo and g.deleted_at is null)
    or config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return pcm.sso_impacto_rotinas_grupo(p_grupo_id);
end; $$;
revoke all on function pcm.sso_impacto_rotinas_grupo_mediado(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_impacto_rotinas_grupo_mediado(uuid,uuid,uuid) to authenticated;

create function pcm.sso_impacto_execucao_grupo_mediado(p_ator_id uuid,p_cliente_id uuid,p_grupo_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_grupo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_impacto_execucao_grupo_gate where id and habilitado for share;
  if not found then raise exception 'impacto_execucao_desabilitado' using errcode='55000'; end if;
  if not exists(select 1 from pcm.grupos_quantitativos g where g.id=p_grupo_id and g.cliente_id=p_cliente_id and g.ativo and g.deleted_at is null)
    or config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return pcm.sso_impacto_execucao_grupo(p_grupo_id);
end; $$;
revoke all on function pcm.sso_impacto_execucao_grupo_mediado(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_impacto_execucao_grupo_mediado(uuid,uuid,uuid) to authenticated;
