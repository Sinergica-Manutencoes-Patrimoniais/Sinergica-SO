-- ADR-1197: mediação sem conceder acesso direto aos núcleos privados.
create function pcm.sso_decisao_vencimento_mediada(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_decisao_id uuid,p_plano_id uuid,p_expected_revision integer,
 p_versao_id uuid,p_rotina_id uuid,p_ciclo integer,p_vencimento date,p_decisao text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_plano_id is null or p_request_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.plano_transicao_gate g where g.id and g.habilitado for share;
 if not found then raise exception 'transicao_plano_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 -- Mesma ordem do núcleo: requestId, depois Plano; protege Cliente enquanto registra.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plano-vencimento:'||p_request_id::text,0));
 perform 1 from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return pcm.sso_registrar_decisao_vencimento(p_request_id,p_decisao_id,p_plano_id,p_expected_revision,p_versao_id,p_rotina_id,p_ciclo,p_vencimento,p_decisao,p_motivo);
end; $$;
revoke all on function pcm.sso_decisao_vencimento_mediada(uuid,uuid,uuid,uuid,uuid,integer,uuid,uuid,integer,date,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decisao_vencimento_mediada(uuid,uuid,uuid,uuid,uuid,integer,uuid,uuid,integer,date,text,text) to authenticated;

create function pcm.sso_historico_vencimento_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_ciclo integer,p_vencimento date,p_apos timestamptz,p_apos_id uuid,p_limite integer)
returns table(id uuid,decisao text,motivo text,ator_id uuid,criado_em timestamptz)
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
 return query select h.id,h.decisao,h.motivo,h.ator_id,h.criado_em from pcm.sso_listar_decisoes_vencimento(p_plano_id,p_versao_id,p_rotina_id,p_ciclo,p_vencimento,p_apos,p_apos_id,p_limite) h;
end; $$;
revoke all on function pcm.sso_historico_vencimento_mediado(uuid,uuid,uuid,uuid,uuid,integer,date,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_vencimento_mediado(uuid,uuid,uuid,uuid,uuid,integer,date,timestamptz,uuid,integer) to authenticated;
