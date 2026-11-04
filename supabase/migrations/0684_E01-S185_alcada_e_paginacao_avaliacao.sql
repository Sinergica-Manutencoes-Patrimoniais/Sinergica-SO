-- ADR-0458: mesma capacidade existente, sem exigir superadmin; manter segregação de autor.
create or replace function pcm.sso_avaliar_evidencia_os(p_request_id uuid,p_cliente_id uuid,p_os_id uuid,p_evidencia_id uuid,p_revisao integer,p_versao_local timestamptz,p_decisao text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n pcm.reconciliacao_os_notas%rowtype; o pcm.ordens_servico%rowtype; a pcm.reconciliacao_os_avaliacoes%rowtype; atual integer;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_os_evidencia_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_os_avaliacao_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_os_id is null or p_evidencia_id is null
    or p_revisao is null or p_revisao<0 or p_versao_local is null or not isfinite(p_versao_local) or p_decisao is null or p_decisao not in ('insuficiente','inconclusiva','investigar')
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('avaliacao-os-request:'||p_request_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('avaliacao-os-evidencia:'||p_evidencia_id::text,0));
  select * into o from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null for share;
  select nota.* into n from pcm.reconciliacao_os_notas nota join pcm.reconciliacao_os_evidencias_manuais e on e.request_id=nota.request_id where nota.request_id=p_evidencia_id and nota.os_id=p_os_id and nota.cliente_id=p_cliente_id;
  if o.id is null or n.request_id is null or n.ator_id=auth.uid() or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into a from pcm.reconciliacao_os_avaliacoes where id=p_request_id;
  if found then
    if a.ator_id is distinct from auth.uid() or a.cliente_id is distinct from p_cliente_id or a.os_id is distinct from p_os_id or a.evidencia_id is distinct from p_evidencia_id
      or a.revisao<>p_revisao+1 or a.versao_local is distinct from p_versao_local or a.decisao is distinct from p_decisao or a.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'revisao',a.revisao,'autorizaRetry',false,'situacaoRemota','desconhecida');
  end if;
  if coalesce(o.updated_at,o.created_at) is distinct from p_versao_local then raise exception 'os_alterada' using errcode='40001'; end if;
  select coalesce(max(revisao),0) into atual from pcm.reconciliacao_os_avaliacoes where evidencia_id=p_evidencia_id;
  if atual<>p_revisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  insert into pcm.reconciliacao_os_avaliacoes(id,evidencia_id,cliente_id,os_id,revisao,versao_local,decisao,motivo,ator_id)
    values(p_request_id,p_evidencia_id,p_cliente_id,p_os_id,atual+1,p_versao_local,p_decisao,btrim(p_motivo),auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'integracao.avaliar_evidencia_os','ordens_servico',p_os_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'evidenciaId',p_evidencia_id,'revisao',atual+1,'decisao',p_decisao));
  return jsonb_build_object('requestId',p_request_id,'revisao',atual+1,'autorizaRetry',false,'situacaoRemota','desconhecida');
end $$;
revoke all on function pcm.sso_avaliar_evidencia_os(uuid,uuid,uuid,uuid,integer,timestamptz,text,text) from public,anon,authenticated,service_role;

create or replace function pcm.sso_historico_avaliacao_os(p_cliente_id uuid,p_os_id uuid,p_evidencia_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o pcm.ordens_servico%rowtype; revisao integer; eventos jsonb; total integer;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_os_evidencia_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_os_avaliacao_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or p_evidencia_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into o from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null;
  if not found or not exists(select 1 from pcm.reconciliacao_os_notas n join pcm.reconciliacao_os_evidencias_manuais e on e.request_id=n.request_id where n.request_id=p_evidencia_id and n.cliente_id=p_cliente_id and n.os_id=p_os_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select coalesce(max(a.revisao),0),count(*) into revisao,total from pcm.reconciliacao_os_avaliacoes a where a.evidencia_id=p_evidencia_id and a.cliente_id=p_cliente_id and a.os_id=p_os_id;
  select coalesce(jsonb_agg(jsonb_build_object('revisao',x.revisao,'decisao',x.decisao,'motivo',x.motivo,'criadoEm',x.criado_em) order by x.revisao desc),'[]'::jsonb) into eventos
    from (select a.revisao,a.decisao,a.motivo,a.criado_em from pcm.reconciliacao_os_avaliacoes a where a.evidencia_id=p_evidencia_id and a.cliente_id=p_cliente_id and a.os_id=p_os_id order by a.revisao desc limit 100) x;
  return jsonb_build_object('osId',p_os_id,'evidenciaId',p_evidencia_id,'revisao',revisao,'versaoLocal',coalesce(o.updated_at,o.created_at),'avaliacoes',eventos,'truncado',total>100,'situacaoRemota','desconhecida','autorizaRetry',false);
end $$;
revoke all on function pcm.sso_historico_avaliacao_os(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_listar_avaliacoes_os(p_cliente_id uuid,p_os_id uuid,p_evidencia_id uuid,p_antes integer,p_limite integer)
returns table(revisao integer,decisao text,motivo text,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_os_evidencia_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_os_avaliacao_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or p_evidencia_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.reconciliacao_os_notas n join pcm.reconciliacao_os_evidencias_manuais e on e.request_id=n.request_id
      join pcm.ordens_servico o on o.id=n.os_id and o.client_id=n.cliente_id and o.deleted_at is null where n.request_id=p_evidencia_id and n.os_id=p_os_id and n.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select a.revisao,a.decisao,a.motivo,a.criado_em from pcm.reconciliacao_os_avaliacoes a where a.evidencia_id=p_evidencia_id and a.cliente_id=p_cliente_id and a.os_id=p_os_id
    and (p_antes is null or a.revisao<p_antes) order by a.revisao desc limit p_limite;
end $$;
revoke all on function pcm.sso_listar_avaliacoes_os(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
