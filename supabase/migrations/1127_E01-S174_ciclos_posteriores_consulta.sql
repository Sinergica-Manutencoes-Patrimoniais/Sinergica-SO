-- ADR-0976: ciclos posteriores são separados do vínculo legado; leitura privada.
create function pcm.sso_candidatos_ciclos_posteriores(p_cliente_id uuid,p_composicao_id uuid,p_apos uuid,p_limite integer)
returns table(pendencia_id uuid,parcela_id uuid,chamado_id uuid,situacao text,ciclo_id uuid,ciclo_estado text,ciclo_revisao integer,
  suspensao_estado text,suspensao_revisao integer,os_id uuid,os_status text,interrupcao_estado text,interrupcao_revisao integer,
  reconciliacao_id uuid,reconciliacao_estado text,reconciliacao_suspensao_revisao integer,reconciliacao_interrupcao_revisao integer,
  prova_parada_disponivel boolean)
language plpgsql volatile security definer set search_path='' as $$
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_diagnostico_devolucao_gate where id and habilitado for share;
  if not found then raise exception 'diagnostico_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_composicao_id is null or p_limite is null or p_limite not between 1 and 50
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not exists(select 1 from pcm.sso_backlog_composicoes b where b.id=p_composicao_id and b.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select ci.pendencia_id,ci.parcela_id,ci.chamado_id,p.situacao,ci.id,ci.estado,ci.revisao,s.estado,s.revisao,
    a.os_id,o.status::text,i.estado,i.revisao,re.id,re.estado,re.suspensao_revision,re.interrupcao_revision,false
  from pcm.sso_ciclos_backlog ci
  join pcm.sso_pendencias_tecnicas pe on pe.id=ci.pendencia_id and pe.cliente_id=ci.cliente_id
  join pcm.chamados ch on ch.id=ci.chamado_id and ch.cliente_id=ci.cliente_id and ch.deleted_at is null
  join pcm.chamado_escopo_parcelas p on p.id=ci.parcela_id and p.chamado_id=ci.chamado_id
  left join pcm.sso_suspensoes_chamado s on s.chamado_id=ci.chamado_id and s.cliente_id=ci.cliente_id
  left join pcm.sso_atribuicoes_parcela a on a.parcela_id=ci.parcela_id and a.chamado_id=ci.chamado_id and a.cliente_id=ci.cliente_id
  left join pcm.ordens_servico o on o.id=a.os_id and o.chamado_id=ci.chamado_id and o.client_id=ci.cliente_id and o.deleted_at is null
  left join pcm.sso_interrupcoes_parcela i on i.parcela_id=ci.parcela_id and i.chamado_id=ci.chamado_id and i.cliente_id=ci.cliente_id and i.os_id=o.id
  left join lateral (select rr.id,rr.estado,rr.suspensao_revision,rr.interrupcao_revision from pcm.sso_reconciliacoes_parcela rr
    where rr.parcela_id=ci.parcela_id and rr.cliente_id=ci.cliente_id and rr.os_id=o.id order by rr.revisao desc limit 1) re on true
  where ci.cliente_id=p_cliente_id and ci.composicao_id=p_composicao_id and ci.legado_pendencia_id is null and (p_apos is null or ci.id>p_apos)
  order by ci.id limit p_limite;
end; $$;
revoke all on function pcm.sso_candidatos_ciclos_posteriores(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
