-- ADR-0158: consulta conservadora e anotações internas. Não envia ou altera outbox.
create table pcm.reconciliacao_outbox_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
alter table pcm.reconciliacao_outbox_gate enable row level security;
alter table pcm.reconciliacao_outbox_gate force row level security;
revoke all on pcm.reconciliacao_outbox_gate from public,anon,authenticated,service_role;
insert into pcm.reconciliacao_outbox_gate(id,habilitado) values(true,false);

create table pcm.reconciliacao_outbox_notas (
  request_id uuid primary key, outbox_id uuid not null, cliente_id uuid not null references pcm.clientes(id),
  actor_id uuid not null references auth.users(id), status_observado text not null,
  tentativas_observadas integer not null, observacao text not null check(length(btrim(observacao)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index reconciliacao_outbox_notas_indice on pcm.reconciliacao_outbox_notas(outbox_id,created_at,request_id);
alter table pcm.reconciliacao_outbox_notas enable row level security;
alter table pcm.reconciliacao_outbox_notas force row level security;
revoke all on pcm.reconciliacao_outbox_notas from public,anon,authenticated,service_role;
create function pcm.sso_proteger_nota_reconciliacao() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'nota_imutavel' using errcode='23514'; end;
$$;
revoke all on function pcm.sso_proteger_nota_reconciliacao() from public,anon,authenticated,service_role;
create trigger nota_reconciliacao_imutavel before update or delete on pcm.reconciliacao_outbox_notas
  for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_listar_outbox_reconciliacao(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,entidade text,objeto_id uuid,operacao text,estado text,estado_fonte text,tentativas integer,enfileirado_em timestamptz,enviado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select o.id,o.entity,o.row_id,o.op,
    case o.status when 'pending' then 'pendente' when 'processing' then 'incerto' when 'error' then 'incerto' else 'enviado_nao_confirmado' end,
    o.status,o.attempts,o.enqueued_at,o.sent_at
    from pcm.auvo_sync_outbox o
    where (p_apos is null or o.id>p_apos) and (
      (o.entity='sistemas' and exists(select 1 from pcm.sistemas s where s.id=o.row_id and s.cliente_id=p_cliente_id)) or
      (o.entity='equipamentos' and exists(select 1 from pcm.equipamentos e where e.id=o.row_id and e.client_id=p_cliente_id)))
    order by o.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_outbox_reconciliacao(uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_anotar_outbox_reconciliacao(p_request_id uuid,p_cliente_id uuid,p_outbox_id uuid,
  p_status_esperado text,p_tentativas_esperadas integer,p_observacao text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid := auth.uid(); v_outbox pcm.auvo_sync_outbox%rowtype; v_nota pcm.reconciliacao_outbox_notas%rowtype;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_cliente_id is null or p_outbox_id is null
    or p_status_esperado not in ('pending','processing','sent','error') or p_status_esperado is null
    or p_tentativas_esperadas is null or p_tentativas_esperadas<0
    or p_observacao is null or length(btrim(p_observacao)) not between 1 and 1000 then
    raise exception 'anotacao_invalida' using errcode='22023'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliacao-nota:' || p_request_id::text,0));
  select * into v_nota from pcm.reconciliacao_outbox_notas where request_id=p_request_id;
  if found then
    if v_nota.actor_id is distinct from v_actor or v_nota.cliente_id is distinct from p_cliente_id
      or v_nota.outbox_id is distinct from p_outbox_id or v_nota.status_observado is distinct from p_status_esperado
      or v_nota.tentativas_observadas is distinct from p_tentativas_esperadas or v_nota.observacao is distinct from btrim(p_observacao) then
      raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'outboxId',p_outbox_id);
  end if;
  select * into v_outbox from pcm.auvo_sync_outbox where id=p_outbox_id for share;
  if not found or not ((v_outbox.entity='sistemas' and exists(select 1 from pcm.sistemas s where s.id=v_outbox.row_id and s.cliente_id=p_cliente_id))
    or (v_outbox.entity='equipamentos' and exists(select 1 from pcm.equipamentos e where e.id=v_outbox.row_id and e.client_id=p_cliente_id))) then
    raise exception 'objeto_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if v_outbox.status is distinct from p_status_esperado or v_outbox.attempts is distinct from p_tentativas_esperadas then
    raise exception 'origem_alterada' using errcode='40001'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  insert into pcm.reconciliacao_outbox_notas(request_id,outbox_id,cliente_id,actor_id,status_observado,tentativas_observadas,observacao)
    values(p_request_id,p_outbox_id,p_cliente_id,v_actor,p_status_esperado,p_tentativas_esperadas,btrim(p_observacao));
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'integracao.nota_outbox','auvo_sync_outbox',p_outbox_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'status',p_status_esperado,'tentativas',p_tentativas_esperadas));
  return jsonb_build_object('requestId',p_request_id,'outboxId',p_outbox_id);
end;
$$;
revoke all on function pcm.sso_anotar_outbox_reconciliacao(uuid,uuid,uuid,text,integer,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_notas_outbox(p_cliente_id uuid,p_outbox_id uuid,p_apos timestamptz,p_apos_id uuid,p_limite integer)
returns table(request_id uuid,ator_id uuid,observacao text,status_observado text,tentativas_observadas integer,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_outbox_id is null
    or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then
    raise exception 'objeto_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or ((p_apos is null) <> (p_apos_id is null)) or (p_apos is not null and not isfinite(p_apos)) then
    raise exception 'paginacao_invalida' using errcode='22023'; end if;
  if not exists(select 1 from pcm.auvo_sync_outbox o where o.id=p_outbox_id and (
    (o.entity='sistemas' and exists(select 1 from pcm.sistemas s where s.id=o.row_id and s.cliente_id=p_cliente_id)) or
    (o.entity='equipamentos' and exists(select 1 from pcm.equipamentos e where e.id=o.row_id and e.client_id=p_cliente_id)))) then
    raise exception 'objeto_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  return query select n.request_id,n.actor_id,n.observacao,n.status_observado,n.tentativas_observadas,n.created_at
    from pcm.reconciliacao_outbox_notas n where n.outbox_id=p_outbox_id and n.cliente_id=p_cliente_id
    and (p_apos is null or (n.created_at,n.request_id)>(p_apos,p_apos_id)) order by n.created_at,n.request_id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_notas_outbox(uuid,uuid,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
