-- ADR-0149: preparação fechada, nenhuma operação externa.
create table pcm.sso_backlog_composicao_gate (id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_backlog_composicao_gate(id,habilitado) values(true,false);
alter table pcm.sso_backlog_composicao_gate enable row level security;
alter table pcm.sso_backlog_composicao_gate force row level security;
revoke all on pcm.sso_backlog_composicao_gate from public, anon, authenticated, service_role;

create table pcm.sso_backlog_composicoes (
  id uuid primary key default gen_random_uuid(), cliente_id uuid not null references pcm.clientes(id),
  alvo_tipo text not null check(alvo_tipo in ('sistema','componente','grupo')), alvo_id uuid not null,
  revisao integer not null default 1 check(revisao > 0), criado_em timestamptz not null default now(), criado_por uuid not null references auth.users(id)
);
create table pcm.sso_backlog_pendencias (
  composicao_id uuid not null references pcm.sso_backlog_composicoes(id), pendencia_id uuid not null unique references pcm.sso_pendencias_tecnicas(id),
  revisao_origem integer not null check(revisao_origem > 0), primary key(composicao_id,pendencia_id)
);
create table pcm.sso_backlog_comandos (
  request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_backlog_composicoes enable row level security;
alter table pcm.sso_backlog_composicoes force row level security;
alter table pcm.sso_backlog_pendencias enable row level security;
alter table pcm.sso_backlog_pendencias force row level security;
alter table pcm.sso_backlog_comandos enable row level security;
alter table pcm.sso_backlog_comandos force row level security;
revoke all on pcm.sso_backlog_composicoes,pcm.sso_backlog_pendencias,pcm.sso_backlog_comandos from public,anon,authenticated,service_role;

create function pcm.sso_compor_backlog_pendencias(p_request_id uuid,p_cliente_id uuid,p_itens jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ator uuid := auth.uid(); v_cmd pcm.sso_backlog_comandos%rowtype; v_item jsonb;
  v_p pcm.sso_pendencias_tecnicas%rowtype; v_alvo_tipo text; v_alvo_id uuid; v_id uuid;
  v_payload jsonb; v_resultado jsonb; v_itens jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_backlog_composicao_gate where id),false) then raise exception 'composicao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_cliente_id is null or jsonb_typeof(p_itens) is distinct from 'array'
    or jsonb_array_length(p_itens) not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if exists(select 1 from jsonb_array_elements(p_itens) e(item) where jsonb_typeof(e.item) is distinct from 'object'
      or not (e.item ? 'id' and e.item ? 'revision') or (select count(*) from jsonb_object_keys(e.item)) <> 2
      or jsonb_typeof(e.item->'id') is distinct from 'string' or jsonb_typeof(e.item->'revision') is distinct from 'number'
      or (e.item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or (e.item->>'revision') !~ '^[1-9][0-9]{0,8}$') then raise exception 'itens_invalidos' using errcode='22023'; end if;
  if (select count(distinct (e.item->>'id')::uuid) from jsonb_array_elements(p_itens) e(item)) <> jsonb_array_length(p_itens)
    then raise exception 'itens_duplicados' using errcode='22023'; end if;
  select jsonb_agg(e.item order by (e.item->>'id')::uuid) into v_itens from jsonb_array_elements(p_itens) e(item);
  v_payload := jsonb_build_object('clienteId',p_cliente_id,'itens',v_itens);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('backlog:' || p_request_id::text,0));
  select * into v_cmd from pcm.sso_backlog_comandos where request_id=p_request_id;
  if found then
    if v_cmd.ator_id is distinct from v_ator or v_cmd.cliente_id is distinct from p_cliente_id then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_cmd.resultado;
  end if;
  for v_item in select e.item from jsonb_array_elements(v_itens) e(item) order by (e.item->>'id')::uuid loop
    select * into v_p from pcm.sso_pendencias_tecnicas where id=(v_item->>'id')::uuid for update;
    if not found or v_p.cliente_id is distinct from p_cliente_id then raise exception 'pendencia_indisponivel' using errcode='23514'; end if;
    if v_p.revisao <> (v_item->>'revision')::integer then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
    if v_p.estado <> 'aberta' or exists(select 1 from pcm.sso_backlog_pendencias where pendencia_id=v_p.id) then raise exception 'pendencia_indisponivel' using errcode='23514'; end if;
    if v_alvo_id is null then v_alvo_id:=v_p.alvo_id; v_alvo_tipo:=v_p.alvo_tipo;
    elsif v_alvo_id is distinct from v_p.alvo_id or v_alvo_tipo is distinct from v_p.alvo_tipo then raise exception 'alvos_diferentes' using errcode='23514'; end if;
  end loop;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  insert into pcm.sso_backlog_composicoes(cliente_id,alvo_tipo,alvo_id,criado_por) values(p_cliente_id,v_alvo_tipo,v_alvo_id,v_ator) returning id into v_id;
  insert into pcm.sso_backlog_pendencias(composicao_id,pendencia_id,revisao_origem)
    select v_id,(e.item->>'id')::uuid,(e.item->>'revision')::integer from jsonb_array_elements(v_itens) e(item);
  v_resultado:=jsonb_build_object('aggregateId',v_id,'revision',1,'state','aguardando','created',true,'linkedIds',jsonb_build_object('pendencias',v_itens),'warnings','[]'::jsonb,'requestId',p_request_id);
  insert into pcm.sso_backlog_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,v_ator,p_cliente_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'backlog.composto','sso_backlog_composicoes',v_id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'itens',v_itens));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_compor_backlog_pendencias(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
