-- ADR-1119: consulta mínima para confirmação, sem revelar o Cliente anterior.
create function pcm.sso_listar_conflitos_propriedade_os_v2(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(os_id uuid,numero text,revisao integer,situacao text,observado_em timestamptz,observacao_revisao integer)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_observacao_novo_cliente_gate where id and habilitado for share;
 if not found then raise exception 'observacao_novo_cliente_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select l.os_id,l.numero,l.revisao,
  case when o.cliente_id=p_cliente_id and exists(select 1 from pcm.sso_decisoes_observacao_novo_cliente d join pcm.ordens_servico os on os.id=d.os_id and os.client_id=p_cliente_id and os.deleted_at is null
   where d.os_id=l.os_id and d.cliente_atual_id=p_cliente_id and d.conflito_revisao=l.revisao
    and o.revisao>=d.observacao_revisao+1 and coalesce(os.updated_at,os.created_at)<=d.criado_em) then 'observacao_atual_iniciada' else l.situacao end::text,
  l.observado_em,
  case when o.cliente_id<>p_cliente_id and config.sso_autorizar_acao('integracao.reconciliar',o.cliente_id) is true then o.revisao else null end
  from pcm.sso_listar_conflitos_propriedade_os(p_ator_id,p_cliente_id,p_apos,p_limite) l
  join pcm.sso_observacoes_os o on o.os_id=l.os_id;
end; $$;
revoke all on function pcm.sso_listar_conflitos_propriedade_os_v2(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_conflitos_propriedade_os_v2(uuid,uuid,uuid,integer) to authenticated;
grant execute on function pcm.sso_iniciar_observacao_novo_cliente(uuid,uuid,uuid,uuid,integer,integer,text) to authenticated;
