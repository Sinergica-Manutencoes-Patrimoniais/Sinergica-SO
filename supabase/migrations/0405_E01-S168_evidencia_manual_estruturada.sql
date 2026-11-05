-- ADR-0179: evidência declarada, sem conteúdo remoto nem validação operacional.
create table pcm.retorno_evidencias_declaradas (
  id uuid primary key, retorno_id uuid not null references pcm.retorno_os_preparado(id),
  revisao integer not null check(revisao>0), tipo text not null check(tipo in ('observacao','referencia_documento')),
  referencia text not null check(length(btrim(referencia)) between 1 and 500),
  descricao text not null check(length(btrim(descricao)) between 1 and 2000),
  request_id uuid not null unique, ator_id uuid not null references auth.users(id), criado_em timestamptz not null default now(),
  unique(retorno_id,revisao)
);
alter table pcm.retorno_evidencias_declaradas enable row level security;
alter table pcm.retorno_evidencias_declaradas force row level security;
revoke all on pcm.retorno_evidencias_declaradas from public,anon,authenticated,service_role;
create function pcm.sso_proteger_evidencia_retorno() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'evidencia_imutavel' using errcode='23514'; end;
$$;
revoke all on function pcm.sso_proteger_evidencia_retorno() from public,anon,authenticated,service_role;
create trigger retorno_evidencia_imutavel before update or delete on pcm.retorno_evidencias_declaradas
  for each row execute function pcm.sso_proteger_evidencia_retorno();

create function pcm.sso_anotar_evidencia_retorno(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_evidencia_id uuid,
  p_expected_revision integer,p_tipo text,p_referencia text,p_descricao text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_retorno pcm.retorno_os_preparado%rowtype;
  v_anterior pcm.retorno_evidencias_declaradas%rowtype; v_revisao integer;
begin
  if not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id),false)
    or not coalesce((select habilitado from pcm.validacao_os_gate where id),false) then raise exception 'retorno_campo_bloqueado' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_evidencia_id is null
    or p_expected_revision is null or p_expected_revision<0 or p_tipo is null or p_tipo not in ('observacao','referencia_documento')
    or p_referencia is null or length(btrim(p_referencia)) not between 1 and 500
    or p_descricao is null or length(btrim(p_descricao)) not between 1 and 2000 then raise exception 'evidencia_invalida' using errcode='22023'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'retorno_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('retorno-evidencia:'||p_request_id::text,0));
  select * into v_anterior from pcm.retorno_evidencias_declaradas where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_actor or v_anterior.id is distinct from p_evidencia_id or v_anterior.retorno_id is distinct from p_retorno_id
      or v_anterior.revisao is distinct from p_expected_revision+1 or v_anterior.tipo is distinct from p_tipo
      or v_anterior.referencia is distinct from btrim(p_referencia) or v_anterior.descricao is distinct from btrim(p_descricao)
      or not exists(select 1 from pcm.retorno_os_preparado r where r.id=p_retorno_id and r.cliente_id=p_cliente_id) then
      raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'retornoId',p_retorno_id,'revision',v_anterior.revisao,'coberturaComprovada',false);
  end if;
  select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id and origem='manual_declarado' for update;
  if not found or not exists(select 1 from pcm.retorno_campo_classificacoes classificacao where classificacao.retorno_id=p_retorno_id)
    or not exists(select 1 from pcm.ordens_servico os where os.id=v_retorno.os_id and os.client_id=p_cliente_id and os.deleted_at is null)
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then
    raise exception 'retorno_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  select coalesce(max(revisao),0) into v_revisao from pcm.retorno_evidencias_declaradas where retorno_id=p_retorno_id;
  if v_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  insert into pcm.retorno_evidencias_declaradas(id,retorno_id,revisao,tipo,referencia,descricao,request_id,ator_id)
    values(p_evidencia_id,p_retorno_id,v_revisao+1,p_tipo,btrim(p_referencia),btrim(p_descricao),p_request_id,v_actor);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.evidencia_manual_declarada','ordens_servico',v_retorno.os_id,
    jsonb_build_object('requestId',p_request_id,'retornoId',p_retorno_id,'evidenciaId',p_evidencia_id,'revision',v_revisao+1));
  return jsonb_build_object('requestId',p_request_id,'retornoId',p_retorno_id,'revision',v_revisao+1,'coberturaComprovada',false);
end;
$$;
revoke all on function pcm.sso_anotar_evidencia_retorno(uuid,uuid,uuid,uuid,integer,text,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_retornos_declarados(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(retorno_id uuid,os_id uuid,envelope_id uuid,revisao_evidencias integer)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id),false)
    or not coalesce((select habilitado from pcm.validacao_os_gate where id),false) then raise exception 'retorno_campo_bloqueado' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'retorno_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select r.id,r.os_id,c.envelope_id,coalesce((select max(e.revisao) from pcm.retorno_evidencias_declaradas e where e.retorno_id=r.id),0)
    from pcm.retorno_os_preparado r join pcm.retorno_campo_classificacoes c on c.retorno_id=r.id
    join pcm.ordens_servico os on os.id=r.os_id and os.client_id=p_cliente_id and os.deleted_at is null
    where r.cliente_id=p_cliente_id and (p_apos is null or r.id>p_apos) order by r.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_retornos_declarados(uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_listar_evidencias_declaradas(p_cliente_id uuid,p_retorno_id uuid,p_apos integer,p_limite integer)
returns table(id uuid,revisao integer,tipo text,referencia text,descricao text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id),false)
    or not coalesce((select habilitado from pcm.validacao_os_gate where id),false) then raise exception 'retorno_campo_bloqueado' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_retorno_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.retorno_os_preparado r join pcm.ordens_servico os on os.id=r.os_id and os.client_id=r.cliente_id and os.deleted_at is null
      where r.id=p_retorno_id and r.cliente_id=p_cliente_id) then raise exception 'retorno_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select e.id,e.revisao,e.tipo,e.referencia,e.descricao,e.ator_id,e.criado_em
    from pcm.retorno_evidencias_declaradas e where e.retorno_id=p_retorno_id and (p_apos is null or e.revisao>p_apos)
    order by e.revisao limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_evidencias_declaradas(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
