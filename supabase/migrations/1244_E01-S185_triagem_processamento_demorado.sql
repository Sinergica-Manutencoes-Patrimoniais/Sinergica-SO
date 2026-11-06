-- ADR-1095: triagem local; sem presumir lease vencido ou efeito remoto.
create function pcm.sso_listar_processamentos_demorados(p_ator_id uuid,p_cliente_id uuid,p_minutos integer,p_apos uuid,p_limite integer)
returns table(outbox_id uuid,entidade text,objeto_id uuid,iniciado_em timestamptz,classificacao text,observado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_minutos is null
   or p_minutos not between 1 and 10080 or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 perform 1 from pcm.sso_observacao_fila_gate where id and habilitado for share;
 if not found then raise exception 'observacao_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select q.id,q.entity,q.row_id,q.processamento_iniciado_em,
   case when q.processamento_iniciado_em is null then 'inicio_desconhecido' else 'tempo_excedido_observado' end::text,now()
 from pcm.auvo_sync_outbox q
 where q.status='processing' and (q.processamento_iniciado_em is null or q.processamento_iniciado_em<=now()-pg_catalog.make_interval(mins=>p_minutos))
   and (p_apos is null or q.id>p_apos)
   and ((q.entity='sistemas' and exists(select 1 from pcm.sistemas s where s.id=q.row_id and s.cliente_id=p_cliente_id))
     or (q.entity='equipamentos' and exists(select 1 from pcm.equipamentos e where e.id=q.row_id and e.client_id=p_cliente_id)))
 order by q.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_processamentos_demorados(uuid,uuid,integer,uuid,integer) from public,anon,authenticated,service_role;
