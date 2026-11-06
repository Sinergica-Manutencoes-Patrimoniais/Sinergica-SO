-- ADR-0455: projeção limitada para revisão humana, sem retentativa externa.
create function pcm.sso_historico_avaliacao_os(p_cliente_id uuid,p_os_id uuid,p_evidencia_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o pcm.ordens_servico%rowtype; revisao integer; eventos jsonb; total integer;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_os_evidencia_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_os_avaliacao_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or auth.jwt()->>'user_role' is distinct from 'superadmin' or p_cliente_id is null or p_os_id is null or p_evidencia_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into o from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null;
  if not found or not exists(select 1 from pcm.reconciliacao_os_notas n join pcm.reconciliacao_os_evidencias_manuais e on e.request_id=n.request_id where n.request_id=p_evidencia_id and n.cliente_id=p_cliente_id and n.os_id=p_os_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select coalesce(max(a.revisao),0),count(*) into revisao,total from pcm.reconciliacao_os_avaliacoes a where a.evidencia_id=p_evidencia_id and a.cliente_id=p_cliente_id and a.os_id=p_os_id;
  select coalesce(jsonb_agg(jsonb_build_object('revisao',x.revisao,'decisao',x.decisao,'motivo',x.motivo,'criadoEm',x.criado_em) order by x.revisao desc),'[]'::jsonb) into eventos
    from (select a.revisao,a.decisao,a.motivo,a.criado_em from pcm.reconciliacao_os_avaliacoes a where a.evidencia_id=p_evidencia_id and a.cliente_id=p_cliente_id and a.os_id=p_os_id order by a.revisao desc limit 100) x;
  return jsonb_build_object('osId',p_os_id,'evidenciaId',p_evidencia_id,'revisao',revisao,'versaoLocal',coalesce(o.updated_at,o.created_at),'avaliacoes',eventos,'truncado',total>100,'situacaoRemota','desconhecida','autorizaRetry',false);
end $$;
revoke all on function pcm.sso_historico_avaliacao_os(uuid,uuid,uuid) from public,anon,authenticated,service_role;
