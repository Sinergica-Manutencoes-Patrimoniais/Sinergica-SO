-- ADR-0271: nova comunicação, nunca restaurar a anterior.
alter table pcm.portal_visita_publicacoes drop constraint portal_visita_publicacoes_visita_id_os_id_revisao_visita_key;
create unique index portal_visita_publicacao_vigente on pcm.portal_visita_publicacoes(visita_id,os_id,revisao_visita) where revogado_em is null;
create or replace function pcm.sso_portal_publicar_visita(p_visita_id uuid,p_os_id uuid,p_revisao integer,p_mensagem text)
returns uuid language plpgsql security definer set search_path='' as $$
begin raise exception 'comando_substituido' using errcode='55000'; end $$;
revoke all on function pcm.sso_portal_publicar_visita(uuid,uuid,integer,text) from public,anon,authenticated,service_role;
create table pcm.portal_visita_publicacao_comandos(
  request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null, publicacao_id uuid not null references pcm.portal_visita_publicacoes(id), criado_em timestamptz not null default now()
);
alter table pcm.portal_visita_publicacao_comandos enable row level security;
alter table pcm.portal_visita_publicacao_comandos force row level security;
revoke all on pcm.portal_visita_publicacao_comandos from public,anon,authenticated,service_role;
create function pcm.sso_portal_publicar_visita_v2(p_request_id uuid,p_visita_id uuid,p_os_id uuid,p_revisao integer,p_mensagem text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v pcm.visitas%rowtype; c pcm.portal_visita_publicacao_comandos%rowtype; v_id uuid; v_payload jsonb;
begin
  if not coalesce((select habilitado from pcm.portal_visita_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_visita_id is null or p_os_id is null or p_revisao is null or p_mensagem is null
    or length(btrim(p_mensagem)) not between 1 and 1000 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('visitaId',p_visita_id,'osId',p_os_id,'revisao',p_revisao,'mensagem',btrim(p_mensagem));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('publicacao-visita:'||p_request_id::text,0));
  select * into v from pcm.visitas where id=p_visita_id for update;
  if not found or config.sso_autorizar_acao('visita.confirmar',v.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into c from pcm.portal_visita_publicacao_comandos where request_id=p_request_id;
  if found then
    if c.ator_id is distinct from auth.uid() or c.cliente_id<>v.cliente_id or c.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return c.publicacao_id;
  end if;
  if v.revisao<>p_revisao or v.estado not in ('planejada','confirmada','enviada','em_execucao','parcial') then raise exception 'visita_obsoleta' using errcode='40001'; end if;
  perform 1 from pcm.visita_ordens_servico vo join pcm.ordens_servico o on o.id=vo.os_id and o.client_id=vo.cliente_id and o.deleted_at is null
    where vo.visita_id=v.id and vo.os_id=p_os_id and vo.cliente_id=v.cliente_id and vo.encerrado_em is null for share of vo,o;
  if not found then raise exception 'vinculo_inexistente' using errcode='23514'; end if;
  if exists(select 1 from pcm.portal_visita_publicacoes where visita_id=v.id and os_id=p_os_id and revisao_visita=v.revisao and revogado_em is null) then raise exception 'publicacao_vigente_existente' using errcode='23505'; end if;
  insert into pcm.portal_visita_publicacoes(cliente_id,visita_id,os_id,revisao_visita,inicio_em,fim_em,mensagem,publicado_por)
    values(v.cliente_id,v.id,p_os_id,v.revisao,v.inicio_em,v.fim_em,btrim(p_mensagem),auth.uid()) returning id into v_id;
  insert into pcm.portal_visita_publicacao_comandos(request_id,ator_id,cliente_id,payload,publicacao_id) values(p_request_id,auth.uid(),v.cliente_id,v_payload,v_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'portal.visita_publicada','visitas',v.id,jsonb_build_object('publicacaoId',v_id,'osId',p_os_id,'revisao',v.revisao,'requestId',p_request_id));
  return v_id;
end $$;
revoke all on function pcm.sso_portal_publicar_visita_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
