-- ADR-1132: identifica conflito sem divulgar o Cliente anterior.
create function pcm.sso_listar_conflitos_propriedade_fila(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(outbox_id uuid,entidade text,objeto_id uuid,revisao integer,situacao text,observado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_quarentena_fila_gate where id and habilitado for share;
 if not found then raise exception 'quarentena_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select c.outbox_id,c.entidade,c.objeto_id,c.revisao,
  case when c.cliente_historico_id=p_cliente_id then 'retorno_observado_conferir' else 'divergencia_observada' end::text,c.atualizado_em
  from pcm.sso_conflitos_propriedade_fila c join pcm.auvo_sync_outbox q on q.id=c.outbox_id and q.entity=c.entidade and q.row_id=c.objeto_id
  where (p_apos is null or c.outbox_id>p_apos) and
   ((c.entidade='sistemas' and exists(select 1 from pcm.sistemas s where s.id=c.objeto_id and s.cliente_id=p_cliente_id))
    or (c.entidade='equipamentos' and exists(select 1 from pcm.equipamentos e where e.id=c.objeto_id and e.client_id=p_cliente_id)))
  order by c.outbox_id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_conflitos_propriedade_fila(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_conflitos_propriedade_fila(uuid,uuid,uuid,integer) to authenticated;
