-- ADR-0369: registro local auditado; não escreve em auvo_sync_outbox nem efetua rede.
create table pcm.intencao_local_envio_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.intencao_local_envio_gate(id,habilitado) values(true,false);
alter table pcm.intencao_local_envio_gate enable row level security;
alter table pcm.intencao_local_envio_gate force row level security;
revoke all on pcm.intencao_local_envio_gate from public,anon,authenticated,service_role;
create function pcm.sso_registrar_intencao_envio_local(p_request_id uuid,p_visita_id uuid,p_os_id uuid,p_revisao integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v pcm.visitas%rowtype; previa pcm.visitas%rowtype; c pcm.visita_confirmacoes%rowtype; pol record;
  comando pcm.visita_comandos%rowtype; payload jsonb; resultado jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_visita_id is null or p_os_id is null or p_revisao is null or p_revisao<1 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  if not coalesce((select habilitado from pcm.intencao_local_envio_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  payload:=jsonb_build_object('tipo','intencaoEnvioLocalBloqueada','visitaId',p_visita_id,'osId',p_os_id,'expectedRevision',p_revisao);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:'||p_request_id::text,0));
  select * into previa from pcm.visitas where id=p_visita_id;
  if not found or config.sso_autorizar_acao('visita.confirmar',previa.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into comando from pcm.visita_comandos where request_id=p_request_id;
  if found then
    if comando.actor_id is distinct from auth.uid() or comando.cliente_id<>previa.cliente_id or comando.payload is distinct from payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return comando.resultado;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ciencia-scope:'||previa.cliente_id::text||':-:-',0));
  if previa.contrato_id is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ciencia-scope:'||previa.cliente_id::text||':'||previa.contrato_id::text||':-',0)); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ciencia-scope:'||previa.cliente_id::text||':-:'||previa.id::text,0));
  select * into v from pcm.visitas where id=p_visita_id for update;
  if not found or v.cliente_id<>previa.cliente_id or v.contrato_id is distinct from previa.contrato_id or v.revisao<>p_revisao or v.estado<>'confirmada' then raise exception 'visita_obsoleta' using errcode='40001'; end if;
  if config.sso_autorizar_acao('visita.confirmar',v.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into c from pcm.visita_confirmacoes where visita_id=v.id and cliente_id=v.cliente_id and revisao=v.revisao;
  select * into pol from pcm.sso_resolver_ciencia_visita(v.id);
  if c.id is null or pol.modo is distinct from c.politica_modo or pol.origem is distinct from c.politica_origem
    or pol.politica_id is distinct from c.politica_id or pol.politica_revisao is distinct from c.politica_revisao then raise exception 'politica_ou_confirmacao_obsoleta' using errcode='40001'; end if;
  perform 1 from pcm.visita_ordens_servico vo join pcm.ordens_servico os on os.id=vo.os_id and os.client_id=vo.cliente_id and os.deleted_at is null
    where vo.visita_id=v.id and vo.os_id=p_os_id and vo.cliente_id=v.cliente_id and vo.encerrado_em is null and os.status not in ('finalizado','cancelado') for share of vo,os;
  if not found then raise exception 'os_indisponivel' using errcode='23514'; end if;
  if pol.modo='obrigatoria' then
    if not coalesce((select habilitado from pcm.portal_confirmacao_cliente_gate where id),false) or not coalesce((select habilitado from pcm.portal_visita_gate where id),false) then raise exception 'fonte_confirmacao_indisponivel' using errcode='55000'; end if;
    perform pub.id from pcm.portal_confirmacoes_cliente x join pcm.portal_visita_publicacoes pub on pub.id=x.publicacao_id
      join pcm.visita_ordens_servico vo on vo.visita_id=pub.visita_id and vo.os_id=pub.os_id and vo.cliente_id=pub.cliente_id and vo.encerrado_em is null
      join pcm.ordens_servico os on os.id=vo.os_id and os.client_id=vo.cliente_id and os.deleted_at is null
      where x.confirmacao_pcm_id=c.id and pub.visita_id=v.id and pub.cliente_id=v.cliente_id and pub.revisao_visita=v.revisao and pub.revogado_em is null for share of pub,vo,os;
    if not found then raise exception 'confirmacao_cliente_ausente' using errcode='23514'; end if;
  end if;
  if exists(select 1 from pcm.visita_comandos x where x.cliente_id=v.cliente_id and x.payload->>'tipo'='intencaoEnvioLocalBloqueada'
    and x.payload->>'visitaId'=v.id::text and x.payload->>'osId'=p_os_id::text and x.payload->>'expectedRevision'=p_revisao::text) then raise exception 'intencao_local_existente' using errcode='23505'; end if;
  resultado:=jsonb_build_object('aggregateId',v.id,'osId',p_os_id,'revision',v.revisao,'requestId',p_request_id,
    'state','bloqueada_sem_dispatch','elegivelEm',v.inicio_em-interval '24 hours','autorizaEnvio',false);
  insert into pcm.visita_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,auth.uid(),v.cliente_id,payload,resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'visita.intencao_local_bloqueada','visitas',v.id,
    jsonb_build_object('requestId',p_request_id,'clienteId',v.cliente_id,'osId',p_os_id,'revision',v.revisao,'politicaModo',pol.modo,'elegivelEm',v.inicio_em-interval '24 hours'));
  return resultado;
end $$;
revoke all on function pcm.sso_registrar_intencao_envio_local(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
