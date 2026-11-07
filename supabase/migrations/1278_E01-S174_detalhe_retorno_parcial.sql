-- ADR-1121: detalhe direto, sem escrita ou efeito remoto.
create function pcm.sso_detalhar_retorno_parcial(p_ator_id uuid,p_cliente_id uuid,p_retorno_id uuid)
returns table(id uuid,ciclo_id uuid,pendencia_id uuid,composicao_id uuid,chamado_id uuid,parcela_id uuid,os_id uuid,proposta_id uuid,
 descricao_restante text,minutos_restantes integer,estado text,revisao integer,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_retorno_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_retorno_parcial_gate where id and habilitado for share;
 if not found then raise exception 'retorno_parcial_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
 if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select r.id,r.ciclo_id,r.pendencia_id,c.composicao_id,r.chamado_id,r.parcela_id,r.os_id,r.proposta_id,
  r.descricao_restante,r.minutos_restantes,r.estado,r.revisao,r.criado_em
  from pcm.sso_retornos_parciais r join pcm.sso_ciclos_backlog c on c.id=r.ciclo_id and c.cliente_id=r.cliente_id
   and c.pendencia_id=r.pendencia_id and c.chamado_id=r.chamado_id and c.parcela_id=r.parcela_id
  where r.id=p_retorno_id and r.cliente_id=p_cliente_id;
end; $$;
revoke all on function pcm.sso_detalhar_retorno_parcial(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_detalhar_retorno_parcial(uuid,uuid,uuid) to authenticated;
