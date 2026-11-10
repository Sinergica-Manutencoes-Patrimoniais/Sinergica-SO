-- ADR-0266: histórico preservado e idempotência de criação.
alter table pcm.portal_pendencia_publicacoes drop constraint portal_pendencia_publicacoes_pendencia_id_revisao_key;
create unique index portal_pendencia_publicacao_vigente on pcm.portal_pendencia_publicacoes(pendencia_id,revisao) where revogado_em is null;
create or replace function pcm.sso_publicar_pendencia_portal(p_pendencia_id uuid,p_revisao integer,p_alvo text,p_descricao text)
returns uuid language plpgsql security definer set search_path='' as $$
begin raise exception 'comando_substituido' using errcode='55000'; end $$;
revoke all on function pcm.sso_publicar_pendencia_portal(uuid,integer,text,text) from public,anon,authenticated,service_role;
create table pcm.portal_pendencia_publicacao_comandos(
  request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null, publicacao_id uuid not null references pcm.portal_pendencia_publicacoes(id), criado_em timestamptz not null default now()
);
alter table pcm.portal_pendencia_publicacao_comandos enable row level security;
alter table pcm.portal_pendencia_publicacao_comandos force row level security;
revoke all on pcm.portal_pendencia_publicacao_comandos from public,anon,authenticated,service_role;
create function pcm.sso_publicar_pendencia_portal_v2(p_request_id uuid,p_pendencia_id uuid,p_revisao integer,p_alvo text,p_descricao text)
returns uuid language plpgsql security definer set search_path='' as $$
declare p pcm.sso_pendencias_tecnicas%rowtype; c pcm.portal_pendencia_publicacao_comandos%rowtype; v_id uuid; v_payload jsonb;
begin
  if not coalesce((select habilitado from pcm.portal_pendencia_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_pendencia_id is null or p_revisao is null or p_alvo is null or p_descricao is null
    or length(btrim(p_alvo)) not between 1 and 200 or length(btrim(p_descricao)) not between 1 and 1000 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('pendenciaId',p_pendencia_id,'revisao',p_revisao,'alvo',btrim(p_alvo),'descricao',btrim(p_descricao));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('publicacao-pendencia:'||p_request_id::text,0));
  select * into p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id for update;
  if not found or config.sso_autorizar_acao('execucao.validar',p.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into c from pcm.portal_pendencia_publicacao_comandos where request_id=p_request_id;
  if found then
    if c.ator_id is distinct from auth.uid() or c.cliente_id<>p.cliente_id or c.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return c.publicacao_id;
  end if;
  if p.revisao<>p_revisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if not exists(select 1 from pcm.ordens_servico o where o.id=p.os_id and o.client_id=p.cliente_id and o.deleted_at is null) then raise exception 'os_indisponivel' using errcode='23514'; end if;
  if exists(select 1 from pcm.portal_pendencia_publicacoes where pendencia_id=p.id and revisao=p.revisao and revogado_em is null) then raise exception 'publicacao_vigente_existente' using errcode='23505'; end if;
  insert into pcm.portal_pendencia_publicacoes(pendencia_id,cliente_id,os_id,revisao,alvo,descricao,estado,publicado_por)
    values(p.id,p.cliente_id,p.os_id,p.revisao,btrim(p_alvo),btrim(p_descricao),p.estado,auth.uid()) returning id into v_id;
  insert into pcm.portal_pendencia_publicacao_comandos(request_id,ator_id,cliente_id,payload,publicacao_id) values(p_request_id,auth.uid(),p.cliente_id,v_payload,v_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'portal.pendencia_publicada','pendencias_tecnicas',p.id,jsonb_build_object('publicacaoId',v_id,'revisao',p.revisao,'requestId',p_request_id));
  return v_id;
end $$;
revoke all on function pcm.sso_publicar_pendencia_portal_v2(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
