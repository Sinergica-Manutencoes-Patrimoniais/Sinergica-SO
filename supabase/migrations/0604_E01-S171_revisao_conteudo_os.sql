-- ADR-0378: revisão dos campos básicos, insuficiente para habilitar envio.
create table pcm.os_conteudo_revisao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.os_conteudo_revisao_gate(id,habilitado) values(true,false);
alter table pcm.os_conteudo_revisao_gate enable row level security;
alter table pcm.os_conteudo_revisao_gate force row level security;
revoke all on pcm.os_conteudo_revisao_gate from public,anon,authenticated,service_role;
create table pcm.os_conteudo_geracoes(os_id uuid primary key references pcm.ordens_servico(id),geracao bigint not null check(geracao>0));
create table pcm.os_conteudo_conferencias(id uuid primary key,os_id uuid not null references pcm.ordens_servico(id),cliente_id uuid not null references pcm.clientes(id),
  visita_id uuid not null references pcm.visitas(id),revisao_visita integer not null check(revisao_visita>0),geracao bigint not null check(geracao>0),
  snapshot jsonb not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now());
alter table pcm.os_conteudo_geracoes enable row level security;
alter table pcm.os_conteudo_geracoes force row level security;
alter table pcm.os_conteudo_conferencias enable row level security;
alter table pcm.os_conteudo_conferencias force row level security;
revoke all on pcm.os_conteudo_geracoes,pcm.os_conteudo_conferencias from public,anon,authenticated,service_role;
create function pcm.sso_snapshot_basico_os(o pcm.ordens_servico) returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('id',o.id,'clienteId',o.client_id,'numero',o.numero,'titulo',o.titulo,'descricao',o.descricao,
    'categoria',o.categoria,'status',o.status,'prioridade',o.prioridade,'localDescricao',o.local_descricao,'excluidaEm',o.deleted_at);
$$;
revoke all on function pcm.sso_snapshot_basico_os(pcm.ordens_servico) from public,anon,authenticated,service_role;
create function pcm.sso_contar_mudanca_basica_os() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if coalesce((select habilitado from pcm.os_conteudo_revisao_gate where id),false) and pcm.sso_snapshot_basico_os(old) is distinct from pcm.sso_snapshot_basico_os(new) then
    insert into pcm.os_conteudo_geracoes(os_id,geracao) values(new.id,1) on conflict(os_id) do update set geracao=pcm.os_conteudo_geracoes.geracao+1;
  end if;
  return new;
end $$;
revoke all on function pcm.sso_contar_mudanca_basica_os() from public,anon,authenticated,service_role;
create trigger sso_os_conteudo_geracao after update on pcm.ordens_servico for each row execute function pcm.sso_contar_mudanca_basica_os();
create function pcm.sso_prever_conteudo_os(p_cliente_id uuid,p_visita_id uuid,p_os_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v pcm.visitas%rowtype; o pcm.ordens_servico%rowtype; g bigint;
begin
  if auth.uid() is null or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or not coalesce((select habilitado from pcm.os_conteudo_revisao_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v from pcm.visitas where id=p_visita_id and cliente_id=p_cliente_id;
  select * into o from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null;
  if v.id is null or o.id is null or v.estado<>'planejada' or not exists(select 1 from pcm.visita_ordens_servico vo where vo.visita_id=v.id and vo.os_id=o.id and vo.cliente_id=p_cliente_id and vo.encerrado_em is null)
    then raise exception 'origem_indisponivel' using errcode='42501'; end if;
  select geracao into g from pcm.os_conteudo_geracoes where os_id=o.id;
  return jsonb_build_object('visitaId',v.id,'visitaRevision',v.revisao,'osId',o.id,'geracao',coalesce(g,1),'snapshot',pcm.sso_snapshot_basico_os(o));
end $$;
revoke all on function pcm.sso_prever_conteudo_os(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_conferir_conteudo_os(p_request_id uuid,p_cliente_id uuid,p_visita_id uuid,p_os_id uuid,p_visita_revision integer,p_geracao bigint,p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v pcm.visitas%rowtype; o pcm.ordens_servico%rowtype; anterior pcm.os_conteudo_conferencias%rowtype; g bigint; resultado jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_visita_id is null or p_os_id is null or p_visita_revision is null or p_geracao is null or p_snapshot is null
    or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from pcm.os_conteudo_revisao_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('os-conteudo:'||p_request_id::text,0));
  select * into v from pcm.visitas where id=p_visita_id and cliente_id=p_cliente_id for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from pcm.os_conteudo_conferencias where id=p_request_id;
  if found then
    if anterior.ator_id is distinct from auth.uid() or anterior.cliente_id<>p_cliente_id or anterior.visita_id<>p_visita_id or anterior.os_id<>p_os_id
      or anterior.revisao_visita<>p_visita_revision or anterior.geracao<>p_geracao or anterior.snapshot is distinct from p_snapshot then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',anterior.id,'geracao',anterior.geracao,'visitaRevision',anterior.revisao_visita,'state','conferida_basica');
  end if;
  select * into o from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null for update;
  if not found or v.estado<>'planejada' or v.revisao<>p_visita_revision or not exists(select 1 from pcm.visita_ordens_servico vo where vo.visita_id=v.id and vo.os_id=o.id and vo.cliente_id=p_cliente_id and vo.encerrado_em is null)
    then raise exception 'origem_obsoleta' using errcode='40001'; end if;
  insert into pcm.os_conteudo_geracoes(os_id,geracao) values(o.id,1) on conflict(os_id) do nothing;
  select geracao into g from pcm.os_conteudo_geracoes where os_id=o.id;
  if g<>p_geracao or pcm.sso_snapshot_basico_os(o) is distinct from p_snapshot then raise exception 'conteudo_obsoleto' using errcode='40001'; end if;
  insert into pcm.os_conteudo_conferencias(id,os_id,cliente_id,visita_id,revisao_visita,geracao,snapshot,ator_id) values(p_request_id,o.id,p_cliente_id,v.id,v.revisao,g,p_snapshot,auth.uid());
  resultado:=jsonb_build_object('requestId',p_request_id,'geracao',g,'visitaRevision',v.revisao,'state','conferida_basica');
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'os.conteudo_basico_conferido','ordens_servico',o.id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'visitaId',v.id,'geracao',g,'visitaRevision',v.revisao));
  return resultado;
end $$;
revoke all on function pcm.sso_conferir_conteudo_os(uuid,uuid,uuid,uuid,integer,bigint,jsonb) from public,anon,authenticated,service_role;
create function pcm.sso_conteudo_basico_conferido(p_visita_id uuid,p_os_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select habilitado from pcm.os_conteudo_revisao_gate where id),false) and exists(
    select 1 from pcm.visitas v join pcm.visita_confirmacoes c on c.visita_id=v.id and c.cliente_id=v.cliente_id and c.revisao=v.revisao
    join pcm.ordens_servico o on o.id=p_os_id and o.client_id=v.cliente_id and o.deleted_at is null
    join pcm.os_conteudo_geracoes g on g.os_id=o.id
    join pcm.os_conteudo_conferencias r on r.os_id=o.id and r.cliente_id=v.cliente_id and r.visita_id=v.id
      and r.revisao_visita=v.revisao-1 and r.geracao=g.geracao and r.criado_em<=c.confirmado_em and r.snapshot=pcm.sso_snapshot_basico_os(o)
    where v.id=p_visita_id and v.estado='confirmada'
  );
$$;
revoke all on function pcm.sso_conteudo_basico_conferido(uuid,uuid) from public,anon,authenticated,service_role;

-- Integrar somente após criação das dependências; permanece sem dispatch.
create or replace function pcm.sso_registrar_intencao_envio_local(p_request_id uuid,p_visita_id uuid,p_os_id uuid,p_revisao integer)
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
  if not pcm.sso_conteudo_basico_conferido(v.id,p_os_id) then raise exception 'conteudo_basico_nao_conferido' using errcode='23514'; end if;
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
