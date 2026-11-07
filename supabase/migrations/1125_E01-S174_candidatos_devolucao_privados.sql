-- ADR-0974: leitura administrativa; não comprova parada nem autoriza devolução.
create function pcm.sso_candidatos_devolucao_ciclo(p_cliente_id uuid,p_composicao_id uuid,p_apos uuid,p_limite integer)
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
  if not exists(select 1 from pcm.sso_backlog_chamado_vinculos v join pcm.chamados c on c.id=v.chamado_id and c.cliente_id=v.cliente_id and c.deleted_at is null
    where v.composicao_id=p_composicao_id and v.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select b.pendencia_id,b.parcela_id,b.chamado_id,p.situacao,ci.id,ci.estado,ci.revisao,s.estado,s.revisao,
    a.os_id,o.status::text,i.estado,i.revisao,re.id,re.estado,re.suspensao_revision,re.interrupcao_revision,false
  from pcm.sso_backlog_parcelas b
  join pcm.chamado_escopo_parcelas p on p.id=b.parcela_id and p.chamado_id=b.chamado_id
  join pcm.sso_backlog_chamado_vinculos v on v.composicao_id=b.composicao_id and v.chamado_id=b.chamado_id and v.cliente_id=b.cliente_id
  left join pcm.sso_ciclos_backlog ci on ci.legado_pendencia_id=b.pendencia_id and ci.cliente_id=b.cliente_id and ci.parcela_id=b.parcela_id and ci.chamado_id=b.chamado_id
  left join pcm.sso_suspensoes_chamado s on s.chamado_id=b.chamado_id and s.cliente_id=b.cliente_id
  left join pcm.sso_atribuicoes_parcela a on a.parcela_id=b.parcela_id and a.chamado_id=b.chamado_id and a.cliente_id=b.cliente_id
  left join pcm.ordens_servico o on o.id=a.os_id and o.chamado_id=b.chamado_id and o.client_id=b.cliente_id and o.deleted_at is null
  left join pcm.sso_interrupcoes_parcela i on i.parcela_id=b.parcela_id and i.chamado_id=b.chamado_id and i.cliente_id=b.cliente_id and i.os_id=o.id
  left join lateral (select rr.id,rr.estado,rr.suspensao_revision,rr.interrupcao_revision from pcm.sso_reconciliacoes_parcela rr
    where rr.parcela_id=b.parcela_id and rr.cliente_id=b.cliente_id and rr.os_id=o.id order by rr.revisao desc limit 1) re on true
  where b.cliente_id=p_cliente_id and b.composicao_id=p_composicao_id and (p_apos is null or b.pendencia_id>p_apos)
  order by b.pendencia_id limit p_limite;
end; $$;
revoke all on function pcm.sso_candidatos_devolucao_ciclo(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
