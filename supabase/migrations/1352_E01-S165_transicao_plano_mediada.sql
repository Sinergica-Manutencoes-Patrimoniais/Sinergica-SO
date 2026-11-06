-- ADR-1198: uma entrada para transição preparada; gate existente fechado.
create function pcm.sso_transicao_plano_mediada(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_plano_id uuid,p_expected_revision integer,p_acao text,p_vigencia date,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_plano_id is null
   or p_acao is null or p_acao not in ('suspender','encerrar','retomar') then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.plano_transicao_gate g where g.id and g.habilitado for share;
 if not found then raise exception 'transicao_plano_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plano-request:'||p_request_id::text,0));
 perform 1 from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_acao='retomar' then return pcm.sso_retomar_plano_preparado(p_request_id,p_plano_id,p_expected_revision,p_vigencia,p_motivo); end if;
 return pcm.sso_transicionar_plano_preparado(p_request_id,p_plano_id,p_expected_revision,p_acao,p_vigencia,p_motivo);
end; $$;
revoke all on function pcm.sso_transicao_plano_mediada(uuid,uuid,uuid,uuid,integer,text,date,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_transicao_plano_mediada(uuid,uuid,uuid,uuid,integer,text,date,text) to authenticated;

create function pcm.sso_historico_transicoes_plano_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_antes integer,p_limite integer)
returns table(id uuid,revisao integer,acao text,estado_anterior text,estado_novo text,vigencia date,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_plano_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.plano_transicao_gate g where g.id and g.habilitado for share;
 if not found then raise exception 'transicao_plano_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id for share;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select h.id,h.revisao,h.acao,h.estado_anterior,h.estado_novo,h.vigencia,h.motivo,h.ator_id,h.criado_em
   from pcm.sso_historico_transicoes_plano(p_cliente_id,p_plano_id,p_antes,p_limite) h;
end; $$;
revoke all on function pcm.sso_historico_transicoes_plano_mediado(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_transicoes_plano_mediado(uuid,uuid,uuid,integer,integer) to authenticated;
