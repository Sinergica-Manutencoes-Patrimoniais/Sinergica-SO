-- ADR-1215: mediação das operações de atribuição sem expor núcleos privados.
create function pcm.sso_exigir_atribuicao_tecnico_mediada(p_ator_id uuid,p_cliente_id uuid,p_visita_id uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_visita_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_resumo_despesa_gate where id and habilitado for share;
  if not found then raise exception 'relatorio_indisponivel' using errcode='55000'; end if;
  if config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.visitas where id=p_visita_id and cliente_id=p_cliente_id for share;
  if not found then raise exception 'visita_indisponivel' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_exigir_atribuicao_tecnico_mediada(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_tecnicos_despesa_visita_mediado(p_ator_id uuid,p_cliente_id uuid,p_visita_id uuid,p_apos uuid)
returns table(id uuid,nome text) language plpgsql volatile security definer set search_path='' as $$
begin
  perform pcm.sso_exigir_atribuicao_tecnico_mediada(p_ator_id,p_cliente_id,p_visita_id);
  return query select * from pcm.sso_tecnicos_despesa_visita(p_cliente_id,p_visita_id,p_apos);
end; $$;
revoke all on function pcm.sso_tecnicos_despesa_visita_mediado(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_tecnicos_despesa_visita_mediado(uuid,uuid,uuid,uuid) to authenticated;

create function pcm.sso_atribuicao_tecnico_despesa_mediada(p_ator_id uuid,p_cliente_id uuid,p_visita_id uuid,p_despesa_id uuid)
returns table(participacao_id uuid,tecnico_nome text,vigente boolean,revisao integer) language plpgsql volatile security definer set search_path='' as $$
begin
  if p_despesa_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pcm.sso_exigir_atribuicao_tecnico_mediada(p_ator_id,p_cliente_id,p_visita_id);
  perform 1 from pcm.despesas_visita where id=p_despesa_id and cliente_id=p_cliente_id and visita_id=p_visita_id for share;
  if not found then raise exception 'despesa_indisponivel' using errcode='42501'; end if;
  return query select * from pcm.sso_atribuicao_tecnico_despesa(p_despesa_id);
end; $$;
revoke all on function pcm.sso_atribuicao_tecnico_despesa_mediada(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_atribuicao_tecnico_despesa_mediada(uuid,uuid,uuid,uuid) to authenticated;

create function pcm.sso_atribuir_tecnico_despesa_mediada(p_ator_id uuid,p_cliente_id uuid,p_visita_id uuid,p_request_id uuid,p_despesa_id uuid,p_expected_revision integer,p_participacao_id uuid,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_despesa_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pcm.sso_exigir_atribuicao_tecnico_mediada(p_ator_id,p_cliente_id,p_visita_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('despesa-visita-request:' || p_request_id::text,0));
  perform 1 from pcm.despesas_visita where id=p_despesa_id and cliente_id=p_cliente_id and visita_id=p_visita_id for update;
  if not found then raise exception 'despesa_indisponivel' using errcode='42501'; end if;
  return pcm.sso_atribuir_tecnico_despesa(p_request_id,p_despesa_id,p_expected_revision,p_participacao_id,p_motivo);
end; $$;
revoke all on function pcm.sso_atribuir_tecnico_despesa_mediada(uuid,uuid,uuid,uuid,uuid,integer,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_atribuir_tecnico_despesa_mediada(uuid,uuid,uuid,uuid,uuid,integer,uuid,text) to authenticated;
