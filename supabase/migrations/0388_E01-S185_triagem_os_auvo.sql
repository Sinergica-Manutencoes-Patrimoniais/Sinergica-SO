-- ADR-0162: triagem local conservadora, sem chamar Auvo.
create table pcm.reconciliacao_os_notas (
  request_id uuid primary key, cliente_id uuid not null references pcm.clientes(id), os_id uuid not null references pcm.ordens_servico(id),
  ator_id uuid not null references auth.users(id), versao_observada timestamptz not null,
  sync_observado text, task_observada text, nota text not null check(length(btrim(nota)) between 1 and 1000),
  criado_em timestamptz not null default now()
);
create index reconciliacao_os_notas_indice on pcm.reconciliacao_os_notas(os_id,criado_em,request_id);
alter table pcm.reconciliacao_os_notas enable row level security;
alter table pcm.reconciliacao_os_notas force row level security;
revoke all on pcm.reconciliacao_os_notas from public,anon,authenticated,service_role;
create trigger nota_os_reconciliacao_imutavel before update or delete on pcm.reconciliacao_os_notas
  for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_listar_os_reconciliacao(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,numero text,status_operacional text,status_sync text,auvo_task_id text,
  atualizado_em timestamptz,classificacao text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select o.id,o.numero::text,o.status::text,o.auvo_sync_status::text,o.auvo_task_id::text,coalesce(o.updated_at,o.created_at),
    case when o.auvo_task_id is not null then 'vinculo_observado_nao_confirmado' else 'incerto' end::text
    from pcm.ordens_servico o where o.client_id=p_cliente_id and o.deleted_at is null
      and (o.auvo_sync_status is not null or o.auvo_task_id is not null)
      and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_os_reconciliacao(uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_anotar_os_reconciliacao(p_request_id uuid,p_cliente_id uuid,p_os_id uuid,p_updated_at timestamptz,
  p_sync text,p_task_id text,p_nota text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid := auth.uid(); v_os pcm.ordens_servico%rowtype; v_nota pcm.reconciliacao_os_notas%rowtype;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_cliente_id is null or p_os_id is null or p_updated_at is null or not isfinite(p_updated_at)
    or p_nota is null or length(btrim(p_nota)) not between 1 and 1000 then raise exception 'anotacao_invalida' using errcode='22023'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then
    raise exception 'os_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliacao-os-nota:' || p_request_id::text,0));
  select * into v_nota from pcm.reconciliacao_os_notas where request_id=p_request_id;
  if found then
    if v_nota.ator_id is distinct from v_actor or v_nota.cliente_id is distinct from p_cliente_id
      or v_nota.os_id is distinct from p_os_id or v_nota.versao_observada is distinct from p_updated_at
      or v_nota.sync_observado is distinct from p_sync or v_nota.task_observada is distinct from p_task_id
      or v_nota.nota is distinct from btrim(p_nota) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'osId',p_os_id);
  end if;
  select * into v_os from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null for share;
  if not found or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then
    raise exception 'os_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  if coalesce(v_os.updated_at,v_os.created_at) is distinct from p_updated_at or v_os.auvo_sync_status is distinct from p_sync or v_os.auvo_task_id::text is distinct from p_task_id then
    raise exception 'origem_alterada' using errcode='40001'; end if;
  insert into pcm.reconciliacao_os_notas(request_id,cliente_id,os_id,ator_id,versao_observada,sync_observado,task_observada,nota)
    values(p_request_id,p_cliente_id,p_os_id,v_actor,p_updated_at,p_sync,p_task_id,btrim(p_nota));
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'integracao.nota_os','ordens_servico',p_os_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'versao',p_updated_at));
  return jsonb_build_object('requestId',p_request_id,'osId',p_os_id);
end;
$$;
revoke all on function pcm.sso_anotar_os_reconciliacao(uuid,uuid,uuid,timestamptz,text,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_notas_os_reconciliacao(p_cliente_id uuid,p_os_id uuid,p_apos timestamptz,p_apos_id uuid,p_limite integer)
returns table(request_id uuid,ator_id uuid,nota text,versao_observada timestamptz,sync_observado text,task_observada text,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null) then
    raise exception 'os_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or ((p_apos is null) <> (p_apos_id is null)) or (p_apos is not null and not isfinite(p_apos)) then
    raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select n.request_id,n.ator_id,n.nota,n.versao_observada,n.sync_observado,n.task_observada,n.criado_em
    from pcm.reconciliacao_os_notas n where n.os_id=p_os_id and n.cliente_id=p_cliente_id
    and (p_apos is null or (n.criado_em,n.request_id)>(p_apos,p_apos_id)) order by n.criado_em,n.request_id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_notas_os_reconciliacao(uuid,uuid,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
