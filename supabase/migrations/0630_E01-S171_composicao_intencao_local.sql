-- ADR-0404: intenção local condicionada à composição; sem despacho.
alter function pcm.sso_registrar_intencao_envio_local(uuid,uuid,uuid,integer) rename to sso_registrar_intencao_envio_local_base_0630;
revoke all on function pcm.sso_registrar_intencao_envio_local_base_0630(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_registrar_intencao_envio_local(p_request_id uuid,p_visita_id uuid,p_os_id uuid,p_revisao integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v pcm.visitas%rowtype; previa pcm.visitas%rowtype; atual jsonb; c pcm.visita_confirmacoes%rowtype;
begin
  if auth.uid() is null or p_request_id is null or p_visita_id is null or p_os_id is null or p_revisao is null or p_revisao<1 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  if not coalesce((select habilitado from pcm.intencao_local_envio_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:'||p_request_id::text,0));
  select * into v from pcm.visitas where id=p_visita_id;
  if not found or config.sso_autorizar_acao('visita.confirmar',v.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  previa:=v;
  -- Recuperação idempotente continua válida, mesmo após mudança posterior.
  if exists(select 1 from pcm.visita_comandos where request_id=p_request_id) then
    return pcm.sso_registrar_intencao_envio_local_base_0630(p_request_id,p_visita_id,p_os_id,p_revisao);
  end if;
  if not coalesce((select habilitado from pcm.visita_composicao_conferencia_gate where id),false) then raise exception 'composicao_indisponivel' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ciencia-scope:'||v.cliente_id::text||':-:-',0));
  if v.contrato_id is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ciencia-scope:'||v.cliente_id::text||':'||v.contrato_id::text||':-',0)); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ciencia-scope:'||v.cliente_id::text||':-:'||v.id::text,0));
  select * into v from pcm.visitas where id=p_visita_id for update;
  if not found or v.cliente_id<>previa.cliente_id or v.contrato_id is distinct from previa.contrato_id or v.revisao<>p_revisao or v.estado<>'confirmada' or config.sso_autorizar_acao('visita.confirmar',v.cliente_id) is distinct from true then raise exception 'visita_obsoleta' using errcode='40001'; end if;
  select * into c from pcm.visita_confirmacoes where visita_id=v.id and cliente_id=v.cliente_id and revisao=v.revisao;
  if c.id is null then raise exception 'confirmacao_ausente' using errcode='23514'; end if;
  perform vo.id from pcm.visita_ordens_servico vo join pcm.ordens_servico o on o.id=vo.os_id and o.client_id=vo.cliente_id
    where vo.visita_id=v.id and vo.cliente_id=v.cliente_id and vo.encerrado_em is null order by vo.id for share of vo,o;
  perform ve.id from pcm.visita_equipes ve join pcm.funcionarios f on f.id=ve.funcionario_id
    where ve.visita_id=v.id and ve.cliente_id=v.cliente_id and ve.encerrado_em is null order by ve.id for share of ve,f;
  insert into pcm.visita_composicao_geracoes(visita_id,geracao) values(v.id,0) on conflict (visita_id) do nothing;
  perform 1 from pcm.visita_composicao_geracoes where visita_id=v.id for update;
  atual:=pcm.sso_snapshot_composicao_visita(v.id,v.cliente_id);
  if not exists(select 1 from pcm.visita_composicao_conferencias x where x.visita_id=v.id and x.cliente_id=v.cliente_id
    and x.revisao_visita=v.revisao-1 and x.criado_em<=c.confirmado_em and x.snapshot=atual) then
    raise exception 'composicao_nao_conferida_ou_alterada' using errcode='23514';
  end if;
  return pcm.sso_registrar_intencao_envio_local_base_0630(p_request_id,p_visita_id,p_os_id,p_revisao);
end $$;
revoke all on function pcm.sso_registrar_intencao_envio_local(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
